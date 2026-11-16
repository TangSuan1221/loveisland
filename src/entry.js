if(new URLSearchParams(location.search).has('perf')){
  const {openStagePreview}=await import('./performance/stage/stage-preview.js');
  await openStagePreview(new URLSearchParams(location.search));
}else if(new URLSearchParams(location.search).has('art-study')){
  await import('./artStudy/studio.js');
}else if(new URLSearchParams(location.search).has('cinema-review')){
  await import('./game.css');
  const {openCinemaReview}=await import('./performance/cinema-review.js');
  await openCinemaReview();
}else if(new URLSearchParams(location.search).has('action-review')){
  document.title='动作验收台 · 荒岛心跳';
  await import('./game.css');
  const {openRehearsal}=await import('./action-rehearsal.js');
  await openRehearsal(null,()=>location.assign(location.pathname));
}else{
  await import('./game.js');
}

