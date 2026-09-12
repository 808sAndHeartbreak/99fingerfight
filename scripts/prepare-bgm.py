"""Prepare the supplied soundtrack loop. Requires ffmpeg and numpy; input is the original MP3."""
import json, subprocess, sys
from pathlib import Path
import numpy as np

source=Path(sys.argv[1])
output=Path('public/assets/music/pixel-afternoon-streets-seamless.mp3')
rate=44100
# Spectral-onset autocorrelation estimates 140 BPM (or its 70 BPM half-time).
bar=60/140*4
overlap=round(bar*rate)
end=round(bar*81*rate)
x=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ac','2','-ar',str(rate),'-f','f32le','-']),dtype=np.float32).reshape(-1,2)
assert len(x)>=end, 'The original soundtrack is shorter than the expected loop.'
x=x[:end]
t=np.linspace(0,1,overlap,dtype=np.float32)[:,None]
fade=.5-.5*np.cos(t*np.pi)
join=x[-overlap:]*(1-fade)+x[:overlap]*fade
# The final sample continues into source[overlap], avoiding a silent restart.
y=np.concatenate([x[overlap:-overlap],join])
y*=min(1,.92/float(abs(y).max()))
subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(rate),'-ac','2','-i','-','-c:a','libmp3lame','-q:a','2',str(output)],input=y.astype(np.float32).tobytes(),check=True)
print(json.dumps({'estimatedBpm':140,'trimEndSeconds':end/rate,'crossfadeSeconds':overlap/rate,'loopSeconds':len(y)/rate,'peak':float(abs(y).max()),'boundaryDelta':float(abs(y[-1]-y[0]).max())},indent=2))
