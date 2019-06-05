# PixelPlanet.fun Bot prototype

## BEFORE WE START (Disclaimer)

DO NOT ABUSE the bot.

Administrators are banning IP addresses of those who abuse bots.

Multiple bots on same IP won't work properly, since timeout is calculated per IP address.

-   Please do not build huge structures/memes or what ever else it maybe near LEGIT player's artwork. YOUR IP WILL GET BANNED.
-   Admins have informed us that only small paintings or big ones far away from everyone (in Antarctica or what ever) are fine.
-   And as always use **common sense**. What if you were the one trying to build pepe the frog by hand, when suddenly there starts to emerge gigantic d\*\*k right in front of you, blocking 1/3 of your painting. Think about it.
-   One last thing. Bots are supposed to help us, don't abuse them.

## Rough steps on how to

1. git pull
2. \*Make sure you have nodejs
3. npm install
4. npm start
5. provide
   x,
   y,
   path to picture,
   other optional parameters

OR

Start program with parameters:

```batch
npm start -- TopLeftX TopLeftY PathToImage Fingerprint [ShouldDither ContinuousWatching DoNotOverrideColors CustomEdgesMapImagePath]
```

Example:

```batch
npm start -- 2000 -12000 photo.png c03a2030024d28a3f080060faf400c00 y n 6,7,4,5
```

```batch
npm start -- 1100 3300 mario.png c03a2030024d28a3f080060faf400c00 n y none
```

### Note

Only first 3 parameters are required.

"--" here means following parameters will be passed directly to executing program.

**Fingerprint is now required**. Since captchas can't be solved automatically, you will have to solve them on your browser. From time to time you might be requested to do so.

## Parameters explained

**TopLeftX** - x coordinate to start image from. Matches top left pixel of the image (2000)

**TopLeftY** - Y coordinate to start image from. Matches top left pixel of the image (-12000)

**PathToImage** - path to an image to draw. (/home/downloads/mario.png)

**Fingerprint** - fingerprint from browser.

**ShouldDither** - Dithering is a way to keep picture looking more "original like" with low amount of colors by adding noise to the image, recommended for photos. Without this a photo would look plain and have a very low color depth look. Enable this feature or not? (y/n)

**ContinuousWatching** - After program finishes, do you want to keep watching over the drawing for any griefings, and keep on fixing? (y/n)

**DoNotOverrideColors** - Option to specify color ids to not draw over. **Write any string if not used**. Used if you want to draw around something, ex. draw rainbow only on white color around other colored drawings. I used it to allow others to contribute live to the progress and not draw over their parts. Specifying "2,6" would ignore all white and black pixels playrs have placed. (2,3,4,5)

## How to get fingerprint:

1. Open up pixelplanet.fun .
2. Press F12. This will open up "Developer tools".
3. Open "Network" tab.
4. There should appear new entry called "pixel". Click on that line.
5. Copy your fingerprint.

    5.1. If you are on Chrome, just scroll down in "Headers" tab until you see "fingerprint". That's it copy it.

    5.2. If you are on Firefox, click "Params" tab and copy the fingerprint.
