// Every material and silhouette uses the user's individual transparent PNG.
// The originals live in gaia-blocks-v1/; these are clean, alpha-cropped copies.
(function () {
    'use strict';
    const prefixes={
        jelly:'01-jelly',
        metal:'02-pink-metal',
        wood:'03-pink-wood',
        neon:'04-neon',
        solid:'05-solid'
    };
    const variants=['long','rect-alt','rect','square'];
    const directory='assets/sprites/gaia-blocks-v1/trimmed/';
    const sprites={};
    for (const [material,prefix] of Object.entries(prefixes)) {
        sprites[material]={};
        for (const variant of variants) {
            const image=new Image();
            const file=`${directory}${prefix}-${variant}.png`;
            image.src=window.GaiaAssetUrl?window.GaiaAssetUrl(file):file;
            sprites[material][variant]=image;
        }
    }
    window.GaiaBlocks={
        sprites,
        get(material,variant='rect') {
            const image=sprites[material]?.[variant];
            return image?.complete && image.naturalWidth>0 ? image : null;
        }
    };
})();
