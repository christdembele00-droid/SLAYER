export type StadiumAudioEvent="kick"|"goal"|"miss"|"tackle"|"whistle"|"post";
export class StadiumAudio { private intensity=0;
 update(tension:number){this.intensity=Math.max(0,Math.min(1,tension));}
 event(_event:StadiumAudioEvent){/* native audio bridge hook */} getIntensity(){return this.intensity;} }
