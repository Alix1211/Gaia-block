// Source artwork remains untouched. This atlas calculates safe alpha bounds per cell.
class SpriteAtlas {
    constructor(url, columns, rows, cuts = null) {
        this.image = new Image();
        this.columns = columns;
        this.rows = rows;
        this.cuts = cuts;
        this.bounds = [];
        this.tints = new Map();
        this.glassCache = new Map();
        this.ready = new Promise(resolve => {
            this.image.onload = () => { this.measure(); resolve(true); };
            this.image.onerror = () => resolve(false);
            this.image.src = window.GaiaAssetUrl ? window.GaiaAssetUrl(url) : url;
        });
    }

    measure() {
        const img = this.image;
        const cw = img.naturalWidth / this.columns;
        const ch = img.naturalHeight / this.rows;
        let pixels = null;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently:true });
            ctx.drawImage(img, 0, 0);
            pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        } catch (e) { /* Some file:// browsers restrict reading pixels. */ }
        for (let i = 0; i < this.columns * this.rows; i++) {
            const col = i % this.columns, row = Math.floor(i / this.columns);
            // AI sprite sheets are not always mathematically even: hand-placed
            // invisible cut lines lie in empty gutters, preventing stray pixels.
            const xc = this.cuts?.xs?.[row], yc = this.cuts?.ys;
            const sx = Math.floor(xc?.[col] ?? col*cw);
            const sy = Math.floor(yc?.[row] ?? row*ch);
            const ex = Math.min(img.naturalWidth,Math.floor(xc?.[col+1] ?? (col+1)*cw));
            const ey = Math.min(img.naturalHeight,Math.floor(yc?.[row+1] ?? (row+1)*ch));
            let minX = ex, maxX = sx, minY = ey, maxY = sy;
            if (pixels) {
                // Tiny translucent glows don't count as part of the cutout.
                for (let y = sy; y < ey; y++) for (let x = sx; x < ex; x++) {
                    if (pixels[(y * img.naturalWidth + x) * 4 + 3] >= 20) {
                        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    }
                }
            }
            this.bounds[i] = minX <= maxX
                ? { x:minX, y:minY, w:maxX-minX+1, h:maxY-minY+1 }
                : { x:sx, y:sy, w:ex-sx, h:ey-sy };
        }
    }

    tinted(index, color) {
        const key = `${index}/${color}`;
        if (this.tints.has(key)) return this.tints.get(key);
        const b = this.bounds[index];
        if (!b) return null;
        const canvas = document.createElement('canvas');
        canvas.width = b.w; canvas.height = b.h;
        const c = canvas.getContext('2d');
        c.drawImage(this.image, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
        c.globalCompositeOperation = 'source-atop';
        c.globalAlpha = .58;
        c.fillStyle = color;
        c.fillRect(0, 0, b.w, b.h);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
        this.tints.set(key, canvas);
        return canvas;
    }

    draw(ctx, index, x, y, width, height, color = null) {
        if (!this.image.complete || !this.image.naturalWidth) return false;
        const b = this.bounds[index];
        if (!b) return false;
        const source = color ? this.tinted(index, color) : this.image;
        if (!source) return false;
        if (color) ctx.drawImage(source, x, y, width, height);
        else ctx.drawImage(source, b.x, b.y, b.w, b.h, x, y, width, height);
        return true;
    }

    // Build colored, gem-like glass only once per visual variant. During play
    // each block is a single image blit, not a gradient + blur + text per frame.
    glassVariant(index, color, mark = '') {
        const key = `${index}/${color}/${mark}`;
        if (this.glassCache.has(key)) return this.glassCache.get(key);
        if (!this.image.complete || !this.image.naturalWidth) return null;
        const b = this.bounds[index];
        if (!b) return null;
        const canvas = document.createElement('canvas');
        canvas.width = b.w;
        canvas.height = b.h;
        const c = canvas.getContext('2d');
        if (!c) return null;
        const pad = Math.max(3, Math.min(b.w, b.h) * .045);
        const rad = Math.max(8, Math.min(b.w, b.h) * .105);
        const gradient = c.createLinearGradient(0, pad, 0, b.h - pad);
        gradient.addColorStop(0, '#fff8ff');
        gradient.addColorStop(.19, color);
        gradient.addColorStop(.72, color);
        gradient.addColorStop(1, '#f3c2e5');
        c.globalAlpha = .84;
        c.fillStyle = gradient;
        c.beginPath();
        c.moveTo(pad + rad, pad);
        c.arcTo(b.w - pad, pad, b.w - pad, b.h - pad, rad);
        c.arcTo(b.w - pad, b.h - pad, pad, b.h - pad, rad);
        c.arcTo(pad, b.h - pad, pad, pad, rad);
        c.arcTo(pad, pad, b.w - pad, pad, rad);
        c.closePath(); c.fill();
        c.globalAlpha = 1;
        c.drawImage(this.image, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
        if (mark) {
            c.font = `bold ${Math.floor(Math.min(b.w * .35, b.h * .53))}px Arial`;
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillStyle = mark === 'heart' ? '#f746a3' : '#fff4b2';
            c.strokeStyle = 'rgba(255,255,255,.86)';
            c.lineWidth = 2;
            const glyph = mark === 'heart' ? '♥' : '✦';
            c.strokeText(glyph, b.w / 2, b.h / 2 + 2);
            c.fillText(glyph, b.w / 2, b.h / 2 + 2);
        }
        this.glassCache.set(key, canvas);
        return canvas;
    }

    drawGlass(ctx, index, x, y, width, height, color, mark = '') {
        const image = this.glassVariant(index, color, mark);
        if (!image) return false;
        ctx.drawImage(image, x, y, width, height);
        return true;
    }
}

window.GaiaArt = {
    balls: new SpriteAtlas('assets/sprites/balls-paddles.png', 6, 4, {
        ys:[0,286,550,770,1024],
        xs:[
            [0,274,523,767,1035,1270,1536],
            [0,277,525,767,1017,1267,1536],
            [0,260,565,770,1008,1275,1536],
            [0,278,533,768,1021,1255,1536]
        ]
    }),
    bricks: new SpriteAtlas('assets/sprites/glass-bricks.png', 4, 4, {
        ys:[0,260,526,742,1024],
        xs:[
            [0,380,638,1023,1536],
            [0,289,713,1146,1536],
            [0,322,709,1134,1536],
            [0,311,721,1135,1536]
        ]
    }),
    // Stage art is loaded by the single full-screen backdrop on demand.
    // Previously all eight large images were decoded on the first frame.
    backgrounds: []
};
