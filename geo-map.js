/** Dependency-free interactive Web Mercator tile map.
 * Tiles are loaded from the official OSM tile endpoint only for the visible viewport.
 * This is a basemap, not a source of live civic incidents.
 */
const TILE=256;
const MERCATOR_LIMIT=85.05112878;
const wrapLongitude=lon=>((lon+180)%360+360)%360-180;
export function projectWgs84(lat,lon,zoom) {
  const safeLat=Math.max(-MERCATOR_LIMIT,Math.min(MERCATOR_LIMIT,lat));
  const sin=Math.sin(safeLat*Math.PI/180),world=TILE*2**zoom;
  return {x:(wrapLongitude(lon)+180)/360*world,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*world};
}
export function unprojectWgs84(x,y,zoom) {
  const world=TILE*2**zoom,vertical=Math.max(0,Math.min(world,y));
  const lat=Math.atan(Math.sinh(Math.PI*(1-2*vertical/world)))*180/Math.PI;
  return {lat,lon:wrapLongitude((x/world)*360-180)};
}
export function metersApproxPerPixel(lat,zoom) {
  return Math.cos(lat*Math.PI/180)*2*Math.PI*6378137/(TILE*2**zoom);
}
const svgNS='http://www.w3.org/2000/svg';
const make=(tag,cls)=>{const el=document.createElement(tag);el.className=cls;return el;};

export class GeoTileMap {
  constructor(container,{onPick=()=>{},onReport=()=>{},onLink=()=>{},onViewChange=()=>{}}={}) {
    this.container=container;this.onPick=onPick;this.onReport=onReport;this.onLink=onLink;this.onViewChange=onViewChange;
    this.center={lat:28.6139,lon:77.2090}; // New Delhi fallback city centre, NOT a report location.
    this.zoom=12;this.nodes=[];this.links=[];this.picked=null;this.picking=false;
    this.tiles=new Map();this.drag=null;this.centerWorld=null;
    this.wheelAccum=0;this.lastWheelAt=-Infinity;this.lastWheelZoomAt=-Infinity;
    this.container.innerHTML='';this.container.classList.add('geotile-map');
    this.container.setAttribute('role','application');
    this.container.setAttribute('aria-label','Interactive OpenStreetMap map. Pan by dragging. Scroll normally to move the page; hold Control or Command and scroll slowly to zoom, or use the plus and minus controls. Enable pin selection to submit a location.');
    this.container.tabIndex=0;
    this.tilePane=make('div','geotile-tiles');
    this.connections=document.createElementNS(svgNS,'svg');this.connections.classList.add('geotile-connections');
    this.markerPane=make('div','geotile-markers');
    this.pinPane=make('div','geotile-pins');
    this.empty=make('div','geotile-empty');this.empty.textContent='Real streets. No user-pinned reports yet.';
    this.attribution=make('div','geotile-attribution');
    const osm=document.createElement('a');osm.href='https://www.openstreetmap.org/copyright';osm.target='_blank';osm.rel='noopener noreferrer';osm.textContent='© OpenStreetMap contributors';
    this.attribution.append('Basemap ',osm);
    this.container.append(this.tilePane,this.connections,this.markerPane,this.pinPane,this.empty,this.attribution);
    this.tilePane.setAttribute('aria-hidden','true');this.connections.setAttribute('aria-hidden','true');
    this.container.addEventListener('pointerdown',e=>this.pointerDown(e));
    this.container.addEventListener('pointermove',e=>this.pointerMove(e));
    this.container.addEventListener('pointerup',e=>this.pointerUp(e));
    this.container.addEventListener('pointercancel',()=>this.drag=null);
    this.container.addEventListener('wheel',e=>this.handleWheel(e),{passive:false});
    this.container.addEventListener('keydown',e=>{
      if(e.key==='+'||e.key==='='){this.zoomBy(1);e.preventDefault();}
      if(e.key==='-'){this.zoomBy(-1);e.preventDefault();}
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
        const dir={ArrowLeft:[-90,0],ArrowRight:[90,0],ArrowUp:[0,-90],ArrowDown:[0,90]}[e.key];
        this.pan(dir[0],dir[1]);e.preventDefault();
      }
    });
    this.resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>this.render()):null;
    this.resizeObserver?.observe(this.container);
    this.render();
  }

  /** Embedded maps must not hijack ordinary page scrolling. Modifier + deliberate
   * accumulated wheel movement is rate-limited to one integer level at a time. */
  handleWheel(e){
    if(!(e.ctrlKey||e.metaKey))return; // Let the page scroll normally.
    e.preventDefault();
    const now=performance.now();
    if(now-this.lastWheelAt>320)this.wheelAccum=0;
    this.lastWheelAt=now;
    const raw=Number(e.deltaY)||0;
    const pixels=raw*(e.deltaMode===1?16:e.deltaMode===2?240:1);
    this.wheelAccum+=Math.max(-120,Math.min(120,pixels));
    // Two conventional mouse ticks, or a deliberate trackpad gesture.
    if(Math.abs(this.wheelAccum)<180||now-this.lastWheelZoomAt<420)return;
    const step=this.wheelAccum<0?1:-1;
    this.wheelAccum=0;this.lastWheelZoomAt=now;
    this.zoomAt(step,e.clientX,e.clientY);
  }
  destroy(){this.resizeObserver?.disconnect();this.tiles.clear();this.container.innerHTML='';}
  setView(lat,lon,zoom=this.zoom){if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>MERCATOR_LIMIT||Math.abs(lon)>180)return;
    this.center={lat,lon:wrapLongitude(lon)};this.zoom=Math.max(3,Math.min(19,Math.round(zoom)));this.render();this.onViewChange(this.zoom);}
  zoomBy(delta){this.zoom=Math.max(3,Math.min(19,this.zoom+delta));this.render();this.onViewChange(this.zoom);}
  zoomAt(delta,clientX,clientY){
    const rect=this.container.getBoundingClientRect(),dx=clientX-rect.left-rect.width/2,dy=clientY-rect.top-rect.height/2;
    const z=Math.max(3,Math.min(19,this.zoom+delta));if(z===this.zoom)return;
    const c=projectWgs84(this.center.lat,this.center.lon,this.zoom),anchor=unprojectWgs84(c.x+dx,c.y+dy,this.zoom);
    const p=projectWgs84(anchor.lat,anchor.lon,z);this.zoom=z;
    this.center=unprojectWgs84(p.x-dx,p.y-dy,z);this.render();this.onViewChange(this.zoom);
  }
  pan(dx,dy){const p=projectWgs84(this.center.lat,this.center.lon,this.zoom);this.center=unprojectWgs84(p.x+dx,p.y+dy,this.zoom);this.render();}
  setPicked(point){this.picked=point;this.renderOverlays();}
  setPicking(on){this.picking=!!on;this.container.classList.toggle('geotile-picking',this.picking);}
  setReports(nodes,links){this.nodes=nodes||[];this.links=links||[];this.renderOverlays();}
  pointerDown(e){if(e.button!==0||e.target.closest('button,a'))return;
    this.drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,pointerId:e.pointerId};
    this.container.setPointerCapture?.(e.pointerId);
  }
  pointerMove(e){if(!this.drag||this.drag.pointerId!==e.pointerId)return;
    const dx=e.clientX-this.drag.lastX,dy=e.clientY-this.drag.lastY;
    this.drag.lastX=e.clientX;this.drag.lastY=e.clientY;
    if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>5)this.drag.moved=true;
    if(this.drag.moved)this.pan(-dx,-dy);
  }
  pointerUp(e){if(!this.drag||this.drag.pointerId!==e.pointerId)return;
    const d=this.drag;this.drag=null;
    if(!d.moved&&this.picking){
      const bounds=this.container.getBoundingClientRect();
      const center=projectWgs84(this.center.lat,this.center.lon,this.zoom);
      const point=unprojectWgs84(center.x+e.clientX-bounds.left-bounds.width/2,
        center.y+e.clientY-bounds.top-bounds.height/2,this.zoom);
      this.setPicked(point);this.setPicking(false);this.onPick(point);
    }
  }
  screenPoint(loc){
    const width=this.container.clientWidth,height=this.container.clientHeight;
    const a=projectWgs84(this.center.lat,this.center.lon,this.zoom),b=projectWgs84(loc.lat,loc.lon,this.zoom);
    const world=TILE*2**this.zoom;
    let dx=b.x-a.x;if(dx>world/2)dx-=world;if(dx<-world/2)dx+=world;
    return {x:width/2+dx,y:height/2+b.y-a.y};
  }
  render(){
    const width=this.container.clientWidth,height=this.container.clientHeight;
    if(width<50||height<50)return;
    const z=this.zoom,worldTiles=2**z,center=projectWgs84(this.center.lat,this.center.lon,z);
    const minX=Math.floor((center.x-width/2)/TILE),maxX=Math.floor((center.x+width/2)/TILE);
    const minY=Math.max(0,Math.floor((center.y-height/2)/TILE)),maxY=Math.min(worldTiles-1,Math.floor((center.y+height/2)/TILE));
    const wanted=new Set();
    for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
      const key=`${z}/${x}/${y}`;wanted.add(key);
      let tile=this.tiles.get(key);
      if(!tile){
        tile=make('img','geotile-img');tile.alt='';tile.decoding='async';tile.draggable=false;
        tile.referrerPolicy='strict-origin-when-cross-origin';
        tile.src=`https://tile.openstreetmap.org/${z}/${((x%worldTiles)+worldTiles)%worldTiles}/${y}.png`;
        this.tiles.set(key,tile);this.tilePane.append(tile);
      }
      tile.style.left=`${Math.round(x*TILE-center.x+width/2)}px`;
      tile.style.top=`${Math.round(y*TILE-center.y+height/2)}px`;
    }
    for(const [key,tile] of this.tiles)if(!wanted.has(key)){tile.remove();this.tiles.delete(key);}
    this.renderOverlays();
  }
  renderOverlays(){
    const w=this.container.clientWidth,h=this.container.clientHeight;
    if(w<50||h<50)return;
    this.markerPane.replaceChildren();this.pinPane.replaceChildren();this.connections.replaceChildren();
    this.connections.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const pointFor=Object.fromEntries(this.nodes.map(n=>[n.id,this.screenPoint(n)]));
    for(const link of this.links){
      const a=pointFor[link.from],b=pointFor[link.to];if(!a||!b)continue;
      const path=document.createElementNS(svgNS,'path');
      path.setAttribute('d',`M${a.x} ${a.y} L${b.x} ${b.y}`);
      path.setAttribute('stroke',link.kind==='contradiction'?'#cc5671':link.kind==='possible-state-change'?'#b88340':link.kind==='nearby-cross-symptom'?'#d2a052':'#6292d3');
      path.setAttribute('stroke-width',['rejected-link','stale-rejected-link'].includes(link.status)?'2':'3');path.setAttribute('stroke-dasharray','6 6');path.setAttribute('fill','none');
      path.setAttribute('opacity',['rejected-link','stale-rejected-link'].includes(link.status)?'.24':'.85');
      path.setAttribute('data-geo-edge',link.id);path.setAttribute('role','button');path.setAttribute('tabindex','0');
      path.setAttribute('aria-label',`Inspect ${link.kind} relationship between ${link.from} and ${link.to}`);
      path.addEventListener('pointerdown',e=>e.stopPropagation());
      path.addEventListener('click',e=>{e.stopPropagation();this.onLink(link.id);});
      path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.onLink(link.id);}});
      this.connections.append(path);
    }
    for(const n of this.nodes){
      const p=pointFor[n.id];if(p.x< -28||p.x>w+28||p.y< -28||p.y>h+28)continue;
      const marker=make('button','geotile-report-marker');marker.type='button';marker.style.left=`${p.x}px`;marker.style.top=`${p.y}px`;
      marker.textContent='●';marker.title=`${n.id} • ${n.language} • user-supplied position`;
      marker.setAttribute('aria-label',`Inspect ${n.id}, user-supplied position`);
      marker.addEventListener('pointerdown',e=>e.stopPropagation());
      marker.addEventListener('click',e=>{e.stopPropagation();this.onReport(n.id);});this.markerPane.append(marker);
    }
    if(this.picked){const p=this.screenPoint(this.picked);const selected=make('div','geotile-selected-pin');
      selected.style.left=`${p.x}px`;selected.style.top=`${p.y}px`;selected.textContent='⌖';
      selected.title='Proposed pin — user selected, not independently verified';this.pinPane.append(selected);}
    this.empty.hidden=this.nodes.length>0;
  }
}
