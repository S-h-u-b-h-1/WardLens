#!/usr/bin/env python3
"""WardLens YouTube master. Original demo footage and narration are preserved.
Design elements and BGM are produced locally; no third-party music is used.
"""
from __future__ import annotations
import argparse
import math
import os
from pathlib import Path
import random
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1920, 1080, 30
INTRO, DEMO, OUTRO = 7, 60, 8
TOTAL = INTRO + DEMO + OUTRO
DARK = "#071520"
ACCENT = "#55e6c5"
WHITE = "#f0fbff"
SOFT = "#a7bcc9"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def run(args):
    print("RUN", " ".join(map(str, args[:5])), "...", flush=True)
    subprocess.run([str(a) for a in args], check=True)


def text(draw, point, text, size, color=WHITE, bold=False, anchor=None):
    font = ImageFont.truetype(BOLD if bold else FONT, size)
    draw.text(point, text, font=font, fill=color, anchor=anchor)


def base_canvas():
    xx = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    halo = np.exp(-(((xx - .78) / .34) ** 2 + ((yy - .45) / .49) ** 2) * 1.4)
    lower = yy * np.ones((1, W), dtype=np.float32)
    rgb = np.empty((H, W, 3), dtype=np.uint8)
    rgb[:, :, 0] = np.clip(7 + 7 * halo + 4 * lower, 0, 255)
    rgb[:, :, 1] = np.clip(20 + 31 * halo + 5 * lower, 0, 255)
    rgb[:, :, 2] = np.clip(31 + 50 * halo + 9 * lower, 0, 255)
    image = Image.fromarray(rgb, "RGB").convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    for x in range(70, W, 90):
        draw.line((x, 0, x, H), fill=(88, 160, 169, 11), width=1)
    for y in range(0, H, 90):
        draw.line((0, y, W, y), fill=(88, 160, 169, 11), width=1)
    return image


ROADS = [
    [(1120, 120), (1220, 215), (1300, 290), (1485, 315), (1680, 460), (1870, 508)],
    [(1020, 780), (1195, 705), (1350, 658), (1500, 690), (1665, 575), (1845, 620)],
    [(1175, 925), (1270, 785), (1350, 658), (1455, 510), (1485, 315), (1600, 175)],
    [(1050, 405), (1240, 445), (1455, 510), (1680, 460), (1820, 300)],
    [(1485, 315), (1555, 720), (1695, 880)],
]


def network(image, opacity=1):
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    for points in ROADS:
        gd.line(points, fill=(59, 232, 209, int(95 * opacity)), width=8, joint="curve")
    glow = glow.filter(ImageFilter.GaussianBlur(22))
    image.alpha_composite(glow)
    d = ImageDraw.Draw(image, "RGBA")
    for points in ROADS:
        d.line(points, fill=(89, 218, 205, int(155 * opacity)), width=2, joint="curve")
    for i, (x, y) in enumerate([(1300, 290), (1485, 315), (1455, 510),
                               (1350, 658), (1665, 575), (1695, 880)]):
        r = 12 if i in (2, 4) else 6
        d.ellipse((x-r*2, y-r*2, x+r*2, y+r*2),
                  fill=(79, 217, 193, int(36 * opacity)))
        d.ellipse((x-r, y-r, x+r, y+r),
                  outline=(145, 255, 232, int(225 * opacity)), width=3)
        d.ellipse((x-3, y-3, x+3, y+3), fill=(183, 255, 237, int(245 * opacity)))


def chip(draw, xy, label, width):
    x, y = xy
    draw.rounded_rectangle((x, y, x+width, y+57), radius=27,
                           fill=(23, 77, 77, 205), outline=(94, 223, 196, 110), width=2)
    text(draw, (x+20, y+16), label, 20, "#bff7e6", bold=True)


def icon(draw, x, y, size=49):
    draw.rounded_rectangle((x, y, x+size, y+size), radius=13,
                           fill=(30, 93, 93, 255), outline=(81, 237, 207, 180), width=2)
    coords = [(x+8,y+16),(x+17,y+33),(x+24,y+17),(x+32,y+32),(x+40,y+15)]
    draw.line(coords, fill=(183, 255, 236, 255), width=4, joint="curve")


def intro_art(out):
    im = base_canvas()
    network(im)
    d = ImageDraw.Draw(im, "RGBA")
    icon(d, 166, 143)
    text(d, (230, 151), "WARDLENS / FIELD ATLAS", 26, "#c0dcd9", bold=True)
    text(d, (166, 318), "WARDLENS", 140, WHITE, bold=True)
    d.rounded_rectangle((171, 510, 370, 519), radius=3, fill=(85, 235, 207, 230))
    text(d, (166, 555), "Every street has a voice.", 50, WHITE)
    text(d, (166, 635), "From words to inspectable evidence.", 37, SOFT)
    chip(d, (166, 770), "GNANI PRISMA v2.5  /  SPEECH-TO-TEXT", 515)
    text(d, (167, 927), "FICTIONAL CIVIC EXAMPLES  •  HUMAN REVIEW REQUIRED", 19, "#9bb8c2")
    im.convert("RGB").save(out, quality=97)


def outro_art(out):
    im = base_canvas()
    network(im, 0.62)
    d = ImageDraw.Draw(im, "RGBA")
    icon(d, 166, 132)
    text(d, (230, 142), "WARDLENS", 31, WHITE, bold=True)
    text(d, (166, 302), "LISTEN.", 104, WHITE, bold=True)
    text(d, (166, 420), "UNDERSTAND.", 104, "#9ff5df", bold=True)
    text(d, (166, 540), "CONNECT.", 104, WHITE, bold=True)
    d.rounded_rectangle((165, 705, 1045, 838), radius=22,
                        fill=(16, 47, 58, 240), outline=(93, 222, 201, 155), width=3)
    text(d, (199, 730), "awaazgraph.vercel.app", 43, WHITE, bold=True)
    text(d, (199, 797), "github.com/S-h-u-b-h-1/WardLens", 29, "#b9e6df")
    text(d, (165, 955), "BUILT WITH GNANI AI  •  PRISMA v2.5", 24, "#a9dfd5", bold=True)
    text(d, (165, 1000), "Fictional observations in the demo. Connections are hypotheses, not verified causes.", 19, SOFT)
    im.convert("RGB").save(out, quality=97)


def thumb(out, screenshot=None):
    im = base_canvas()
    network(im, 0.75)
    d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle((95, 95, 1825, 985), radius=42, fill=(7, 20, 31, 140),
                        outline=(86, 223, 201, 105), width=3)
    icon(d, 145, 158, 60)
    text(d, (220, 173), "WARDLENS", 37, WHITE, bold=True)
    text(d, (145, 328), "YOUR CITY.", 91, WHITE, bold=True)
    text(d, (145, 446), "IN CONTEXT.", 83, "#91f0d7", bold=True)
    text(d, (151, 634), "VOICE  /  MAP  /  EVIDENCE", 31, SOFT, bold=True)
    chip(d, (146, 777), "BUILT WITH GNANI AI", 337)
    if screenshot and Path(screenshot).exists():
        pic = Image.open(screenshot).convert("RGB")
        pic.thumbnail((630, 380), Image.Resampling.LANCZOS)
        background = Image.new("RGBA", (pic.width+24, pic.height+24), (13, 42, 53, 255))
        bd = ImageDraw.Draw(background, "RGBA")
        bd.rounded_rectangle((0,0,pic.width+23,pic.height+23), radius=22,
                             outline=(96, 236, 217, 235), width=4)
        background.paste(pic, (12,12))
        im.alpha_composite(background, dest=(1130, 385))
    im.resize((1280,720), Image.Resampling.LANCZOS).convert("RGB").save(out, optimize=True)


def generate_score(out):
    sr = 32000
    N = int(TOTAL*sr)
    y = np.zeros(N, dtype=np.float32)
    rng = np.random.default_rng(2608)
    bpm = 94
    beat = 60 / bpm
    chords = [
        [50, 57, 60, 64, 69],       # Dm9
        [46, 53, 57, 62, 65],       # Bbmaj9
        [53, 60, 64, 67, 72],       # Fmaj9
        [48, 55, 60, 64, 67],       # Cadd9
    ]
    def hz(m): return 440 * (2 ** ((m-69)/12))
    def add(at, tone, dur, amp, decay=1.8, pad=False):
        if at >= TOTAL:return
        n = min(int(dur*sr),N-int(at*sr))
        if n<=0:return
        t=np.arange(n,dtype=np.float32)/sr
        freq=hz(tone)
        if pad:
            fade=np.minimum(1,t/.70)*np.minimum(1,(dur-t)/.55)
            waves=(np.sin(2*np.pi*freq*t)*.67
                 +np.sin(2*np.pi*(freq*1.002)*t)*.19
                 +np.sin(2*np.pi*(freq*2)*t)*.11)
            env=np.maximum(0,fade)
        else:
            env=(1-np.exp(-t*37))*np.exp(-t*decay)
            waves=np.sin(2*np.pi*freq*t)+.15*np.sin(2*np.pi*freq*2.01*t)
        start=int(at*sr)
        y[start:start+n]+=amp*env*waves
    bars=math.ceil(TOTAL/(beat*4))
    for bar in range(bars):
        start=bar*beat*4
        chord=chords[(bar//2)%len(chords)]
        for tone in chord:
            add(start, tone, beat*4+.4, .015, pad=True)
        add(start, chord[0]-12, 1.8, .065, decay=1.6)
        for step in (1,3,5,6):
            note=chord[(step+bar)%len(chord)]+12
            add(start+step*beat/2, note, .68, .033, decay=6.0)
    # Gentle pulse and light original sound design. All samples are synthesized.
    for k in np.arange(0,TOTAL,beat):
        st=int(k*sr);ln=min(int(.24*sr),N-st)
        if ln<1:continue
        tt=np.arange(ln,dtype=np.float32)/sr
        beat_signal=np.sin(2*np.pi*(59*tt+16*(1-np.exp(-tt*27))))
        y[st:st+ln]+=.095*np.exp(-tt*20)*beat_signal
    for k in np.arange(beat/2,TOTAL,beat/2):
        st=int(k*sr);ln=min(int(.074*sr),N-st)
        if ln<1:continue
        tt=np.arange(ln,dtype=np.float32)/sr
        noise=rng.standard_normal(ln).astype(np.float32)
        noise=np.concatenate(([0],np.diff(noise)))
        y[st:st+ln]+=.009*np.exp(-tt*48)*noise
    # Transitions at start and end of original narration.
    for at in (6.5,66.5):
        ln=int(.6*sr);st=int(at*sr)
        tt=np.arange(ln,dtype=np.float32)/sr
        raw=rng.standard_normal(ln).astype(np.float32)
        y[st:st+ln]+=.007*(np.sin(np.pi*tt/.6)**2)*raw
    time=np.arange(N,dtype=np.float32)/sr
    # Music ducks under the real demo narration, returns for the CTA.
    duck=np.where((time>=INTRO)&(time<INTRO+DEMO),.32,.86)
    trans=np.minimum(1,np.maximum(0,(time-INTRO+.8)/1.5))
    duck=np.where((time>INTRO-.8)&(time<INTRO+.7),.86*(1-trans)+.32*trans,duck)
    trans=np.minimum(1,np.maximum(0,(time-INTRO-DEMO+.6)/1.4))
    duck=np.where((time>INTRO+DEMO-.6)&(time<INTRO+DEMO+.8),.32*(1-trans)+.86*trans,duck)
    fade=np.minimum(1,time/1.7)*np.minimum(1,(TOTAL-time)/2.0)
    y *= duck*np.maximum(fade,0)
    peak=max(np.max(np.abs(y)),.001)
    y=np.tanh(y*(.63/peak))
    stereo=np.stack([y,np.roll(y,68)*.98],axis=1)
    data=np.asarray(np.clip(stereo*32767,-32768,32767),dtype=np.int16)
    with wave.open(str(out),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes(data.tobytes())
    print("Original instrumental music synthesized; samples",N,flush=True)


def encode_card(image, duration, output):
    # Subtle cinematic push-in, with proper entry/exit fades.
    vf=(f"scale=2010:1131,"
        f"crop=1920:1080:x='45+20*sin(t*0.55)':y='26+10*cos(t*0.5)',"
        f"fps={FPS},fade=t=in:st=0:d=0.65,"
        f"fade=t=out:st={duration-.50}:d=.5,format=yuv420p")
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-loop","1",
         "-framerate",str(FPS),"-i",image,"-t",str(duration),"-vf",vf,
         "-an","-c:v","libx264","-preset","veryfast","-crf","21",
         "-pix_fmt","yuv420p","-r",str(FPS),output])


def middle_video(src, output):
    # Border/frame outside footage; the 60s real recording remains unmodified.
    topics=[
     ("01  REPORT IN YOUR OWN WORDS",0,12),
     ("02  REVIEW YOUR TRANSCRIPTION",12,24),
     ("03  LOCATE THE OBSERVATION",24,36),
     ("04  EXPLORE POSSIBLE CONNECTIONS",36,48),
     ("05  EVIDENCE FIRST. HUMAN REVIEW.",48,60)
    ]
    common=(f"fontfile={BOLD}:fontcolor=0x9ef4df:fontsize=29:"
            f"x=165:y=1020")
    tagfilters=",".join(
      f"drawtext={common}:text='{name}':enable='between(t,{lo},{hi})'"
      for name,lo,hi in topics
    )
    complex_filter=(
      "[1:v]scale=1578:888:flags=lanczos,fps=30,"
      "pad=1600:908:11:10:color=0x14394d,setsar=1[demo];"
      "[0:v][demo]overlay=x=160:y=95:shortest=1,"
      "drawbox=x=0:y=0:w=iw:h=90:color=0x071623:t=fill,"
      f"drawtext=fontfile={BOLD}:text='WARDLENS  /  PRODUCT WALKTHROUGH':"
      "fontcolor=0xf0fbff:fontsize=31:x=165:y=28,"
      f"drawtext=fontfile={FONT}:text='VOICE  -  MAP  -  EVIDENCE':"
      "fontcolor=0x9bdcca:fontsize=24:x=w-tw-165:y=31,"
      "drawbox=x=160:y=1011:w=1600:h=2:color=0x3b807e:t=fill,"
      "drawbox=x=0:y=1072:w=iw:h=8:color=0x3fcab4:t=fill,"
      f"{tagfilters},"
      f"drawtext=fontfile={FONT}:text='FICTIONAL DEMO  |  GNANI PRISMA v2.5':"
      "fontcolor=0x88a8b8:fontsize=20:x=w-tw-166:y=1029,"
      "format=yuv420p[v]"
    )
    run(["ffmpeg","-hide_banner","-loglevel","error","-y",
         "-f","lavfi","-i",f"color=c=0x071520:s={W}x{H}:r={FPS}:d={DEMO}",
         "-i",src,"-filter_complex",complex_filter,
         "-map","[v]","-t",str(DEMO),"-an","-c:v","libx264",
         "-preset","veryfast","-crf","21","-pix_fmt","yuv420p",
         "-r",str(FPS),output])


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("source",type=Path,help="Original 60-second WardLens MP4")
    parser.add_argument("--out-dir",type=Path,default=Path("render"))
    a=parser.parse_args()
    a.out_dir.mkdir(parents=True,exist_ok=True)
    src=a.source.resolve()
    if not src.exists() or src.stat().st_size<500_000:
        raise SystemExit("Original recorded demo MP4 is required, not a mock video.")
    d=a.out_dir
    intro_art(d/"intro.png");outro_art(d/"outro.png")
    shot=d/"screenshot.jpg"
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-ss","26",
         "-i",src,"-frames:v","1","-vf","scale=720:405","-q:v","4",shot])
    thumb(d/"WardLens_YouTube_Thumbnail.png",shot)
    generate_score(d/"original_music.wav")
    encode_card(d/"intro.png",INTRO,d/"intro.mp4")
    middle_video(src,d/"middle.mp4")
    encode_card(d/"outro.png",OUTRO,d/"outro.mp4")
    concat=d/"segments.txt"
    concat.write_text("".join(f"file '{name}'\n" for name in ["intro.mp4","middle.mp4","outro.mp4"]))
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat",
         "-safe","0","-i",concat,"-c","copy","-an",d/"silent.mp4"])
    final=d/"WardLens_Cinematic_YouTube_Showcase.mp4"
    # Original narration is retained, with original instrumental under it.
    graph=("[1:a]aresample=48000,volume=1.06,adelay=7000,"
           "apad,atrim=0:75[voice];"
           "[2:a]aresample=48000,volume=.95[score];"
           "[voice][score]amix=inputs=2:duration=longest:normalize=0,"
           "alimiter=limit=.95[a]")
    run(["ffmpeg","-hide_banner","-loglevel","error","-y",
         "-i",d/"silent.mp4","-i",src,"-i",d/"original_music.wav",
         "-filter_complex",graph,"-map","0:v","-map","[a]",
         "-c:v","copy","-c:a","aac","-b:a","192k","-ar","48000",
         "-t",str(TOTAL),"-movflags","+faststart",final])
    run(["ffprobe","-v","error","-show_entries","format=duration,size:"
         "stream=codec_name,codec_type,width,height,r_frame_rate",
         "-of","json",final])
    print("COMPLETE",final,final.stat().st_size,"bytes",flush=True)


if __name__=="__main__": main()
