# Browser acceptance evidence

24 October 2026. Actual Chrome tab loaded the new page from the existing local HTTP preview. This is viewport emulation and synthetic input, not physical hardware.

- One payments story, three scenes, no workflow selector. Stock illustrations render consistently; full Solborne & Co. wordmark, company, contact, policy and attribution links appear in the footer.
- Next/previous buttons and ArrowDown move between scenes. A wheel input moves one scene while scrollY remains zero. A trackpad-sized deltaY4 input advanced1 to2 after page settlement. A synthetic touch swipe back moved3 to2, scrollY zero.
- At360x640, settled owner scene: deck top62/bottom503.56; first content top95.48/last content bottom470.5. Content centre282.99 versus deck centre282.78. Footer fits through viewport bottom640. At390x844 the same text/art group is centred together.
- Read all destroys the enhancement and restores the linear document. Changing reduced-motion preference afterward produced no browser errors. Reload with reduced motion, then navigate: wrapper transitionDuration0s, progress2/3 and scrollY0. Test overrides were reset.
- At1920x945, desktop text centre431.492 versus illustration centre431.5: under0.01px difference. JavaScript disabled and page reloaded: all3headings remain in the linear document, height2005px, with no enhanced class. Script execution, touch emulation, reduced-motion override and viewport were restored afterward.
- Live staging checks are recorded in the release receipt after deployment. Inactive scenes have aria-hidden=true and are made inert by the adapter; active scene is exposed. Automated adapter checks cover read-all, missing vendor and reduced motion; browser checks cover actual stock input and geometry.

Automated build:155 self-contained assets. Full platform tests:377 passed,0 failed. Link audit:21pages,573links,185assets,0 failures. Independent review raised two issues, fixed before staging: per-event trackpad threshold and motion listener after destruction.
