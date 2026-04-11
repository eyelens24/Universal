# Universal
[Universal Navigation Suite](https://eyelens24.github.io/Universal/)

NASA uses a program called PNT (Position, Navigation and Timing) where its purpose is to:
1. Precisely locate a spacecraft in space
2. Calculate and adjust trajectories
3. Do extremely precise calculations for timing


Some problems with it is that:
1. It has heavy reliance on communication to earth, what happens if that communication is lost?
2. The signal can take a while to transmit, and becomes less accurate the further they are from earth
3. Trajectories done on earth are precomputed and hard to adapt to dynamically


Our goal is to improve this system so that it can be used by the people on the spaceship as well and so that there is tracking within the spaceship to make it less troublesome in the case that communication is lost or takes too long when immediate action is needed

**Background Info**

At its core, SGM is an app that lets the user plan their ship's trajectories and chart the fastest, safest, and most efficient route in terms of its fuel usage. This app seeks to aide the future of space travel, where mission parameters may change. Sometimes, life or death decisions won't wait for a response from back on earth, which may take dasys to arrive. Sometimes astronauths need to make them, without having the time to wait. This is what SGM is trying to fix. 

SGM was inspired by the real life NASA PNT progrram (Position, Navigation, and Timing), as well as the mission controls used by various space missions althroughout the years. We aim to improve and add upon them, as well as make it simpler, so that while not as complex, it can still be used as an alternative data source, when astronauths aren't able to wait for earth's response. Aside from that, it was actually inspired by the project hailmary scene, where Dr. Grace wasn't able to figure anything out, because he couldn't ask earth, as it would take months for his message to be received, and for him to receive anything back. 

To build this program, we used javascript, HTML, and CSS. as the backbone. Before that however, we spent most of our time researching things that may affect a spaceship's trajectory as well as it's crew's safety. We then used this to impliment countless calculations for our app, and streamlined everything.

The hardest challenge we had during this project was actually making sure all the equations worked as intended to. Such as making the fuel usage also take into account the gravitational pull of celestial bodies as well as the engine. This is a challenge, as we had to double check, even tripple check wether the equation was correct, and made sure every equation worked together properly.

One of the things we are most proud of is how simplistic we made our UI look, while still packing it with a lot of features. Although it seems simplistic at the start, you can actually click on many buttons, such as the planets, to show an overview about it, or the numbers alongside the route, showing why it took that turn. Besides that, we are proud of how our calculations turned out, as it took a lot of research to perfect.

Through all this, we learned how to use javascript better, alongside how to research better. We also learned how to design a good looking UI, and especially make it really interactive. Although not perfect, we are really proud of what we made.

There are still lots of things that can be improved upon from this app. One of which is when the time comes, I know that this app can be used as the backbone of interstellar travel, even beyond our star. It can also make space travel easier one day, when we get advanced enough, where even civillians have access to it, and not just governments.

