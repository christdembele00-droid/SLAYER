from dataclasses import dataclass
from time import time
@dataclass
class Ticket:
    player_id:str; region:str; mode:str; version:str; skill:float; created_at:float
class Matchmaking:
    def __init__(self): self.queue:list[Ticket]=[]
    def enqueue(self,t:Ticket): self.queue.append(t); return self.match()
    def match(self):
        for i,a in enumerate(self.queue):
            for j in range(i+1,len(self.queue)):
                b=self.queue[j]
                if a.mode==b.mode and a.version==b.version and abs(a.skill-b.skill)<=250:
                    self.queue.pop(j); self.queue.pop(i); return (a,b)
        return None
