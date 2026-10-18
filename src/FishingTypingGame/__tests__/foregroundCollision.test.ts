import {foregroundCollision} from '../scene/foregroundCollision';

declare const test:any,expect:any,jest:any,afterEach:any;
afterEach(()=>jest.restoreAllMocks());
const bounds={left:0,top:0,width:800,height:600} as DOMRect;
let fixtureNumber=0;
function fixture(){
  const scene=document.createElement('div'),image=document.createElement('img');scene.append(image);
  image.src=`/shore-${fixtureNumber++}.png`;image.dataset.sceneDepth='foreground';image.style.setProperty('--parallax','.5');
  Object.defineProperties(image,{complete:{value:true},naturalWidth:{value:4},naturalHeight:{value:2}});
  const geometry=jest.spyOn(image,'getBoundingClientRect').mockReturnValue({left:100,top:100,width:400,height:200} as DOMRect);
  const rgba=new Uint8ClampedArray(4*2*4);rgba[1*4+3]=255;rgba[6*4+3]=255;
  const context={drawImage:jest.fn(),getImageData:jest.fn(()=>({data:rgba}))};
  jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as any);
  const collision=foregroundCollision(scene);collision.measure(bounds);
  return {scene,image,geometry,context,collision};
}

test('only painted foreground pixels block; masks and geometry are reused while flying',()=>{
  const {collision,geometry,context,scene,image}=fixture();
  expect(collision.hit(.3125,.25)).toBe(true);expect(collision.hit(.1875,.25)).toBe(false);expect(collision.hit(.8,.8)).toBe(false);
  for(let i=0;i<100;i++)collision.hit(.3125,.25);
  expect(geometry).toHaveBeenCalledTimes(1);expect(context.getImageData).toHaveBeenCalledTimes(1);
  scene.style.setProperty('--scene-x','200');
  expect(collision.hit(.3125,.25)).toBe(false);expect(collision.hit(.4375,.25)).toBe(true);
  collision.measure(bounds);expect(context.drawImage).toHaveBeenCalledTimes(1);
  image.src='/new-season.png';collision.measure(bounds);expect(context.drawImage).toHaveBeenCalledTimes(2);
  const duplicate=image.cloneNode() as HTMLImageElement;
  Object.defineProperties(duplicate,{complete:{value:true},naturalWidth:{value:4},naturalHeight:{value:2}});
  duplicate.getBoundingClientRect=()=>({left:100,top:100,width:400,height:200} as DOMRect);scene.append(duplicate);
  collision.measure(bounds);expect(context.drawImage).toHaveBeenCalledTimes(2);
});

test('mirroring, clipped reed halves and hidden parents respect visible artwork',()=>{
  const {collision,image,scene}=fixture();
  image.style.setProperty('--flip-x','-1');collision.measure(bounds);
  expect(collision.hit(.3125,.25)).toBe(false);expect(collision.hit(.4375,.25)).toBe(true);
  image.dataset.layer='foreground-reeds';image.style.clipPath='inset(0 50% 0 0)';collision.measure(bounds);
  expect(collision.hit(.4375,.25)).toBe(false);
  const hidden=document.createElement('div');hidden.style.opacity='0';scene.append(hidden);hidden.append(image);
  collision.measure(bounds);expect(collision.hit(.4375,.25)).toBe(false);
});
