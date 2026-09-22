import { MatchEvent, MatchEventName } from "../core/MatchEvents";
import { AudioEngine } from "../audio/AudioEngine";
export class CommentarySystem {
  private readonly lines: string[] = [];
  constructor(private readonly audio: AudioEngine) {}
  start(events: { on<K extends MatchEventName>(name: K, listener: (event: MatchEvent<K>) => void): () => void }) {
    const listen=(name: MatchEventName, fn:(e:MatchEvent<any>)=>void)=>events.on(name as any,fn as any);
    const unsubs=[
      listen("KickOff",()=>this.say("Coup d'envoi !","whistle")),
      listen("Shot",()=>this.say("Frappe !","shot")),
      listen("Save",()=>this.say("Quel arrêt du gardien !","save")),
      listen("Goal",()=>this.say("BUT ! Quelle action !","goal")),
      listen("HalfTime",()=>this.say("Mi-temps.","whistle")),
      listen("MatchEnded",()=>this.say("Coup de sifflet final.","whistle"))
    ];
    return ()=>unsubs.forEach(u=>u());
  }
  get recent(): readonly string[] { return this.lines; }
  private say(text:string,event:Parameters<AudioEngine["play"]>[0]){
    this.lines.push(text); if(this.lines.length>12)this.lines.shift();
    this.audio.play(event);
    if(typeof window!=="undefined" && "speechSynthesis" in window){
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }
}