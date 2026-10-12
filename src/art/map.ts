/** Authored fictional political atlas. Geometry is presentation only; live facts live in StrategicMap. */
import type { CountryId } from '../engine/types';
import { t } from '../i18n';
import { n, poly, type Pt } from './util';
import { uid } from './rng';

export const MAP_ANCHORS: Record<CountryId, Pt> = {
  atlantic:[205,156], commonwealth:[496,106], hanzhou:[796,156], meridian:[758,336],
};
export const MAP_COLORS: Record<CountryId,string> = {
  atlantic:'#638bd0', commonwealth:'#d5b064', hanzhou:'#c66556', meridian:'#61b396',
};
const REGIONS: Record<CountryId,Pt[][]> = {
  atlantic:[[[74,91],[112,72],[142,76],[159,49],[191,59],[224,40],[249,63],[295,65],[316,92],[349,100],[366,131],[347,152],[353,171],[326,177],[321,201],[295,206],[278,234],[251,237],[239,260],[218,266],[196,247],[185,220],[163,225],[146,203],[123,196],[114,169],[88,157],[94,133],[67,117]]],
  commonwealth:[[[425,100],[440,83],[455,86],[470,60],[486,68],[504,49],[523,57],[530,76],[556,65],[576,88],[590,92],[597,112],[575,123],[570,146],[543,149],[525,168],[505,161],[484,178],[469,155],[446,158],[439,136],[418,129]]],
  hanzhou:[[[614,92],[647,76],[675,81],[690,55],[721,59],[744,43],[782,58],[816,48],[838,70],[873,71],[903,96],[924,103],[933,132],[911,147],[920,165],[893,181],[864,178],[848,200],[818,207],[803,232],[779,238],[764,217],[735,214],[717,195],[687,200],[664,183],[653,157],[632,147],[637,121],[611,112]]],
  meridian:[[[705,281],[728,269],[752,276],[771,266],[790,283],[804,286],[805,310],[784,323],[779,347],[760,354],[742,333],[719,332],[705,315]],[[822,310],[839,301],[852,313],[849,329],[827,338],[814,328]],[[681,332],[699,323],[707,338],[699,352],[684,355],[675,345]]],
};
const NEUTRAL:Pt[][]=[
 [[216,284],[243,275],[264,287],[280,283],[300,303],[307,325],[290,348],[295,366],[271,394],[260,417],[243,409],[239,383],[225,366],[229,344],[211,323]],
 [[441,205],[472,195],[491,204],[525,193],[551,205],[578,206],[591,229],[586,257],[565,277],[562,309],[546,329],[527,365],[510,366],[502,342],[481,327],[478,298],[459,282],[461,257],[443,239]],
 [[849,359],[874,348],[897,351],[911,338],[938,358],[950,379],[930,389],[924,409],[895,416],[868,405],[846,408],[832,389]],
 [[357,49],[377,34],[401,42],[413,60],[394,73],[368,66]],
 [[604,218],[621,209],[638,218],[640,235],[622,246],[611,232]],
 [[383,245],[397,232],[411,244],[405,266],[391,269]],
 [[94,332],[113,322],[126,337],[116,352],[97,348]],
];

/** Fine irregular coves use fixed authored geometry, never simulation RNG or hidden state. */
function coast(points:Pt[]):string {
 const detailed:Pt[]=[];
 points.forEach((p,i)=>{
  const q=points[(i+1)%points.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);
  detailed.push(p);
  const steps=Math.floor(length/10);
  for(let j=1;j<steps;j++){
   const f=j/steps,offset=Math.sin(i*2.71+j*3.83)*Math.min(2.7,length*.07);
   detailed.push([p[0]+dx*f-dy/length*offset,p[1]+dy*f+dx/length*offset]);
  }
 });
 return poly(detailed);
}
const RELIEF:Record<CountryId,string>={
 atlantic:'M131 107l7-13 7 14 5-8 8 16 6-10 8 17M139 138l8-11 7 14 6-7 8 19M153 168l7-10 8 16 5-7 7 13M247 110l6-8 5 10 5-7 7 10M268 163l6-9 7 13 5-6 5 9',
 commonwealth:'M452 126l7-9 7 8 8-13 7 14 6-7 7 12 7-10 7 9 7-13 8 12 5-7 7 10M483 84l6-9 7 10M548 101l7-7 7 8',
 hanzhou:'M646 104l9-12 9 17 7-12 8 15 8-11 11 21M660 137l9-13 10 16 7-7 9 16 8-14 10 18M687 172l9-12 9 15 8-9 9 16 6-8 9 12M828 99l8-10 9 12 7-8 8 10M844 143l7-9 8 10 6-8 9 10',
 meridian:'M721 295l6-10 7 13 6-8 7 15 5-9 7 14 5-7 8 13M831 315l5-7 5 9',
};
const RIVERS:Record<CountryId,string>={
 atlantic:'M198 83Q219 110 211 136T201 171Q209 196 243 225M245 144Q220 155 201 171',
 commonwealth:'M526 84Q507 103 524 124T521 157M480 105Q491 113 501 127',
 hanzhou:'M729 94Q745 114 766 115T807 139Q817 154 838 169M706 154Q738 164 760 155T798 170Q805 187 812 203',
 meridian:'M756 280Q745 303 762 335',
};

/** Labels and interactive markers are HTML, so they never become illegible SVG microtype. */
export function atlasBase(player?:CountryId,selected?:CountryId):string {
 let graticule='';
 for(let x=100;x<1000;x+=100)graticule+=`M${x} 0Q${500+(x-500)*1.15} 230 ${x} 460`;
 for(let y=76;y<460;y+=76)graticule+=`M0 ${y}Q500 ${y+(y-230)*.07} 1000 ${y}`;
 const neutral=NEUTRAL.map(p=>`<path d="${coast(p)}" fill="#536f76" stroke="#8aa19d" stroke-width="1.1"/>`).join('');
 const regions=(Object.keys(REGIONS) as CountryId[]).map(id=>{
  const chosen=id===selected,mine=id===player;
  const outline=REGIONS[id].map(coast).join(''),clip=uid(`atlas-${id}`);
  return `<defs><clipPath id="${clip}"><path d="${outline}"/></clipPath></defs><g class="atlas-region${mine?' is-player':''}${chosen?' is-selected':''}" data-country="${id}">`+
  `<path d="${outline}" fill="${MAP_COLORS[id]}" fill-opacity="${chosen?'.8':mine?'.64':'.49'}" stroke="#071b2b" stroke-width="4"/><path d="${outline}" fill="none" stroke="${chosen?'#fff0ca':mine?'#d4c393':MAP_COLORS[id]}" stroke-width="${chosen?2.3:1.2}"/>`+
  `<g clip-path="url(#${clip})"><path d="${RELIEF[id]}" fill="none" stroke="#d6decd" stroke-width="1.8" stroke-opacity=".37" stroke-linejoin="round"/><path d="${RIVERS[id]}" fill="none" stroke="#072738" stroke-opacity=".6" stroke-width="2"/></g></g>`;
 }).join('');
 const inner=`<rect width="1000" height="460" fill="#0b293b"/><path d="${graticule}" stroke="#718a91" stroke-opacity=".17" stroke-width="1" fill="none"/><path d="M0 230H1000" stroke="#8a9c9a" stroke-opacity=".25" stroke-dasharray="3 9"/>${neutral}<path d="M230 310l6-11 7 17 5-7 7 15 3 9 6 11 2 13 7 12M497 229l8-11 8 15 6-8 7 18 7-11 7 14M520 285l8-12 7 16 8-8 7 13M863 376l8-10 8 12 7-7 9 12" fill="none" stroke="#b2c0b5" stroke-opacity=".25" stroke-width="1.7"/>${regions}`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="460" viewBox="0 0 1000 460" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`;
}

/** Legacy ArtAPI entry point, now the same cartographic base used by the live atlas. */
export function worldMap(player:CountryId,width=640):string {
 return atlasBase(player).replace('width="1000" height="460"',`width="${n(width)}" height="${n(width*.46)}"`).replace('aria-hidden="true"',`role="img" aria-label="${t('World map')}"`);
}
