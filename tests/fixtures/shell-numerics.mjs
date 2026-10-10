import {rectangularShellElement,factorShellBand,SHELL_GAUSS} from '../../app/lib/shell-solver.ts';
// Independent analytic Navier Fourier series for uniform pressure and hard simply supported Mindlin plate.
export function navierCenter(s,terms=101,thin=false) {
 const {width:a,depth:b,thickness:h}=s.plate,{E,nu}=s.material;
 const D=E*h**3/(12*(1-nu**2)),S=5/6*E/(2*(1+nu))*h; let w=0;
 for(let m=1;m<=terms;m+=2)for(let n=1;n<=terms;n+=2) {
  const k2=(m*Math.PI/a)**2+(n*Math.PI/b)**2;
  const qmn=-16/(Math.PI**2*m*n);
  w+=qmn*Math.sin(m*Math.PI/2)*Math.sin(n*Math.PI/2)*(1/(D*k2**2)+(thin?0:1/(S*k2)));
 }
 return w;
}
// Gauss bilinear extrapolation to a mesh vertex; average adjacent element values, no peak selection.
export function interiorMoments(result,s,x,y) {
 const {nx,ny}=s.mesh, values=[];
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++) {
  const xi=2*(x*nx-i)-1,eta=2*(y*ny-j)-1;
  if(Math.abs(xi)>1+1e-10||Math.abs(eta)>1+1e-10)continue;
  const e=result.elements[j*nx+i];
  values.push([3,4,5].map(k=>e.points.reduce((v,p)=>v+p.resultants[k]*(1+3*xi*p.xi)*(1+3*eta*p.eta)/4,0)));
 }
 return [0,1,2].map(k=>values.reduce((v,p)=>v+p[k],0)/values.length);
}
// Separate membrane benchmark assembly: all transverse DOFs fixed, exact boundary line tractions.
export function membranePatch(s,kind) {
 const {nx,ny}=s.mesh,{width:a,depth:b,thickness:h}=s.plate,m=s.material,count=(nx+1)*(ny+1);
 const kernel=rectangularShellElement(a/nx,b/ny,m.E,m.nu,h),ids=[],fixed=new Uint8Array(count*6),F=new Float64Array(count*6);
 const tag=(i,j)=>j*(nx+1)+i;
 for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++) {
  const n=tag(i,j),k=6*n;
  fixed[k]=+(i===0&&j===0); fixed[k+1]=+(j===0&&(i===0||i===nx));for(const d of [2,3,4])fixed[k+d]=1;
 }
 for(let j=0;j<=ny;j++)for(const [i,sign] of [[0,-1],[nx,1]])F[6*tag(i,j)+(kind==='MEM-X'?0:1)]+=sign*b/ny*(j===0||j===ny?.5:1);
 if(kind==='MEM-XY')for(let i=0;i<=nx;i++)for(const [j,sign] of [[0,-1],[ny,1]])F[6*tag(i,j)]+=sign*a/nx*(i===0||i===nx?.5:1);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)ids.push([tag(i,j),tag(i+1,j),tag(i+1,j+1),tag(i,j+1)].flatMap(n=>Array.from({length:6},(_,k)=>6*n+k)));
 const index=new Int32Array(count*6).fill(-1);let n=0;for(let i=0;i<index.length;i++)if(!fixed[i])index[i]=n++;
 const band=Math.min(n,6*(nx+2)),K=new Float64Array(n*band);
 for(const dofs of ids)for(let i=0;i<24;i++)for(let j=0;j<24;j++){const r=index[dofs[i]],c=index[dofs[j]];if(c>=0&&r>=c)K[r*band+r-c]+=kernel.K[i*24+j];}
 const rhs=new Float64Array(n);for(let k=0;k<index.length;k++)if(index[k]>=0)rhs[index[k]]=F[k];
 const u=factorShellBand(K,n,band).solve(rhs),U=Float64Array.from(index,i=>i<0?0:u[i]),internal=new Float64Array(U.length);
 for(const dofs of ids)for(let i=0;i<24;i++)for(let j=0;j<24;j++)internal[dofs[i]]+=kernel.K[i*24+j]*U[dofs[j]];
 return {nodes:Array.from({length:count},(_,i)=>({displacements:Array.from(U.slice(i*6,i*6+6)),reactions:Array.from({length:6},(_,k)=>fixed[i*6+k]?internal[i*6+k]-F[i*6+k]:0)})),
 elements:ids.map(dofs=>({points:SHELL_GAUSS.map(([x,y])=>kernel.sample(dofs.map(i=>U[i]),x,y))}))};
}
