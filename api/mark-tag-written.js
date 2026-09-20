import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
function svc(){if(!getApps().length)initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n')})});return {auth:getAuth(),db:getFirestore()}}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const h=req.headers.authorization||'';
  if(!h.startsWith('Bearer '))return res.status(401).json({error:'Unauthorized'});
  const {auth,db}=svc(),u=await auth.verifyIdToken(h.slice(7));
  if(!process.env.DREAMORA_ADMIN_UID||u.uid!==process.env.DREAMORA_ADMIN_UID)return res.status(403).json({error:'Admin access unavailable.'});
  const tag=String(req.body?.tag||'').trim().toUpperCase();
  if(!tag)return res.status(400).json({error:'Missing tag.'});
  const ref=db.collection('publicTags').doc(tag),snap=await ref.get();
  if(!snap.exists)return res.status(404).json({error:'Tag not found.'});
  const d=snap.data();
  if(d.createdBy!==u.uid)return res.status(403).json({error:'Not allowed.'});
  if(d.status==='claimed')return res.status(409).json({error:'This tag is already claimed.'});
  await ref.update({status:'written',writtenAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  return res.status(200).json({ok:true,status:'written'});
 }catch(e){return res.status(500).json({error:'Could not update tag.'})}
}