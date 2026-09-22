export type AudioEvent="kick"|"pass"|"shot"|"tackle"|"save"|"goal"|"crowd"|"whistle";
export type AudioChannel="music"|"commentary"|"crowd"|"effects";
export class AudioEngine{
  private ctx:AudioContext|null=null;
  enabled=true;
  private buses:Partial<Record<AudioChannel,GainNode>>={};
  private ensure(){
    if(!this.enabled)return null;
    if(!this.ctx){
      this.ctx=new AudioContext();
      for(const channel of ["music","commentary","crowd","effects"] as AudioChannel[]){
        const gain=this.ctx.createGain(); gain.gain.value=1; gain.connect(this.ctx.destination); this.buses[channel]=gain;
      }
    }
    return this.ctx
  }
  async resume(){const c=this.ensure();if(c&&c.state==="suspended")await c.resume()}
  setChannelVolume(channel:AudioChannel,percent:number){
    const c=this.ensure(); const bus=this.buses[channel]; if(!c||!bus)return;
    bus.gain.setTargetAtTime(Math.max(0,Math.min(1,percent/100)),c.currentTime,.025);
  }
  setMixer(music:number,commentary:number,crowd:number,effects:number){
    this.setChannelVolume("music",music);this.setChannelVolume("commentary",commentary);this.setChannelVolume("crowd",crowd);this.setChannelVolume("effects",effects);
  }
  play(event:AudioEvent,intensity=1){
    const c=this.ensure();if(!c)return;
    const f:{[k:string]:number}={kick:110,pass:150,shot:95,tackle:70,save:180,goal:240,crowd:320,whistle:1200};
    const channel:AudioChannel=event==="crowd"?"crowd":event==="whistle"||event==="goal"?"commentary":"effects";
    const o=c.createOscillator(),g=c.createGain();
    o.frequency.value=f[event]*(.8+intensity*.2);
    g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.06,c.currentTime+.01);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.12);
    o.connect(g).connect(this.buses[channel]??c.destination);o.start();o.stop(c.currentTime+.13)
  }
}