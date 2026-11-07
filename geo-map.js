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
    this.zoom=12;this.nodes=[];this.links=[];this.picked=null;this.pic¶»§q«^