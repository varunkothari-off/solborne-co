/* Stock Swiper owns movement, wheel, keyboard, touch and buttons. */
(()=>{
 const deck=document.querySelector('.payment-deck');
 const toggle=document.querySelector('#reading-mode');
 const progress=document.querySelector('#scene-progress');
 const slides=[...document.querySelectorAll('.payment-deck .swiper-slide')];
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 if(!deck||!window.Swiper||new URLSearchParams(window.location.search).get('read')==='all')return;
 function expose(swiper){
  slides.forEach((slide,index)=>{slide.inert=index!==swiper.activeIndex;slide.setAttribute('aria-hidden',String(index!==swiper.activeIndex));});
  progress.textContent=(swiper.activeIndex+1)+' / '+slides.length;
 }
 document.body.classList.add('scene-mode');
 let swiper;
 try{
  swiper=new window.Swiper(deck,{
   direction:'vertical',slidesPerView:1,speed:reduced.matches?0:380,loop:false,
   preventInteractionOnTransition:true,simulateTouch:true,threshold:30,
   mousewheel:{enabled:true,forceToAxis:true,releaseOnEdges:false,thresholdTime:650,eventsTarget:'.scene-shell'},
   keyboard:{enabled:true,onlyInViewport:true,pageUpDown:true},
   navigation:{prevEl:'.scene-prev',nextEl:'.scene-next'},
   a11y:{enabled:true,containerRole:'region',containerMessage:'Payment journey',slideLabelMessage:'Scene {{index}} of {{slidesLength}}',prevSlideMessage:'Previous scene',nextSlideMessage:'Next scene'},
   on:{init:expose,slideChange:expose}
  });
 }catch{document.body.classList.remove('scene-mode');slides.forEach(slide=>{slide.inert=false;slide.setAttribute('aria-hidden','false');});return;}
 reduced.addEventListener('change',event=>{if(!swiper.destroyed&&swiper.params)swiper.params.speed=event.matches?0:380;});
 // Horizontal arrow aliases use the same component; native vertical keys belong to Swiper.
 document.addEventListener('keydown',event=>{
  if(!document.body.classList||swiper.destroyed||event.repeat||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
   event.preventDefault();if(!swiper.animating)(event.key==='ArrowRight'?swiper.slideNext():swiper.slidePrev());
  }
 });
 toggle.addEventListener('click',()=>{
  swiper.destroy(true,true);document.body.classList.remove('scene-mode');
  slides.forEach(slide=>{slide.inert=false;slide.setAttribute('aria-hidden','false');});
 });
})();
