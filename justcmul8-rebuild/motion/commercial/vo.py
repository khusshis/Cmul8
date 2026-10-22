# python vo.py [rate] [voice] -> vo/full.wav (48k mono, trimmed) + words.js (window.WORDS=[[start,end,word],...] in seconds, relative to trimmed audio)
import asyncio, json, sys, subprocess, os
import edge_tts
SCRIPT=open('script.txt',encoding='utf8').read().strip()
RATE=sys.argv[1] if len(sys.argv)>1 else '+10%'
VOICE=sys.argv[2] if len(sys.argv)>2 else 'en-US-AndrewMultilingualNeural'
FF=subprocess.check_output(['node','-p',"require('ffmpeg-static')"],text=True).strip()
async def main():
    for k in range(6):
        try:
            c=edge_tts.Communicate(SCRIPT,VOICE,rate=RATE,boundary='WordBoundary')
            audio=bytearray();words=[]
            async for ch in c.stream():
                if ch['type']=='audio':audio+=ch['data']
                elif ch['type']=='WordBoundary':words.append([ch['offset']/1e7,(ch['offset']+ch['duration'])/1e7,ch['text']])
            if audio and words:break
        except Exception as e:
            print('retry',k,e);await asyncio.sleep(2*(k+1))
    os.makedirs('vo',exist_ok=True);open('vo/full.mp3','wb').write(audio)
    lead=words[0][0]-0.02  # trim leading silence so word 0 starts at ~0
    subprocess.run([FF,'-loglevel','error','-y','-ss',f'{lead:.3f}','-i','vo/full.mp3','-ar','48000','-ac','1','vo/full.wav'],check=True)
    words=[[round(a-lead,3),round(b-lead,3),w] for a,b,w in words]
    open('words.js','w').write('(function(){const W='+json.dumps(words)+';if(typeof module!=="undefined")module.exports=W;else window.WORDS=W;})();\n')
    print(f'{len(words)} words, speech ends at {words[-1][1]:.2f}s')
    for a,b,w in words:print(f'{a:6.2f} {w}')
asyncio.run(main())
