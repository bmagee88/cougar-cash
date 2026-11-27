// Mechanical connected-component measurements for sprite registration.
function components(data,width,height,alpha=128,withPixels=false){
  const seen=new Uint8Array(width*height),queue=new Int32Array(width*height),parts=[];
  for(let start=0;start<seen.length;start++){
    if(seen[start] || data[start*4+3]<alpha)continue;
    let head=0,tail=1,left=width,top=height,right=0,bottom=0,sumX=0,sumY=0;queue[0]=start;seen[start]=1;
    while(head<tail){const index=queue[head++],x=index%width,y=Math.floor(index/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);sumX+=x;sumY+=y;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;const next=ny*width+nx;if(!seen[next]&&data[next*4+3]>=alpha){seen[next]=1;queue[tail++]=next;}}
    }
    parts.push({size:tail,left,top,right,bottom,cx:sumX/tail,cy:sumY/tail,...(withPixels?{indices:Int32Array.from(queue.subarray(0,tail))}:{})});
  }
  return parts.sort((a,b)=>b.size-a.size);
}
module.exports={components};
