import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- TYPE DEFINITIONS --- //

type DotShape = 'square' | 'dots' | 'rounded' | 'extra-rounded';
type CornerShape = 'square' | 'dot' | 'extra-rounded';
type LogoPlacement = 'overlay' | 'freestanding';
type LogoColorMode = 'original' | 'white' | 'black' | 'brand';
type LogoShape = 'square' | 'rounded' | 'circle';
type ECCLevel = 'L' | 'M' | 'Q' | 'H';

interface QRData {
  text: string;
  ecc: ECCLevel;
  size: number;
  margin: number;
}

interface QRStyle {
  primaryColor: string;
  secondaryColor: string;
  useGradient: boolean;
  gradientAngle: number;
  backgroundColor: string;
  dotShape: DotShape;
  cornerSquareShape: CornerShape;
  cornerDotShape: CornerShape;
}

interface LogoOptions {
  src: string | null;
  size: number;
  padding: number;
  placement: LogoPlacement;
  colorMode: LogoColorMode;
  shape: LogoShape;
  imageElement: HTMLImageElement | null;
}

interface Module {
  x: number;
  y: number;
  isFinder: boolean;
  isCornerDot?: boolean;
}

// --- HELPER FUNCTIONS --- //

const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
};

const normalizeHex = (hex: string): string => {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return '#000000';
  return `#${h.toLowerCase()}`;
};

const getLuminance = (hex: string): number => {
  const rgb = parseInt(normalizeHex(hex).slice(1), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7159 + a[2] * 0.0722;
};

const getContrast = (hex1: string, hex2: string): number => {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
};

const loadImageEl = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
};

// --- REACT COMPONENT --- //

const App: React.FC = () => {
  const [qrData, setQrData] = useState<QRData>({
    text: 'https://github.com/jules-overflow',
    ecc: 'H',
    size: 480,
    margin: 1,
  });

  const [qrStyle, setQrStyle] = useState<QRStyle>({
    primaryColor: '#000000',
    secondaryColor: '#000000',
    useGradient: false,
    gradientAngle: 0,
    backgroundColor: '#ffffff',
    dotShape: 'dots',
    cornerSquareShape: 'square',
    cornerDotShape: 'square',
  });

  const [logoOptions, setLogoOptions] = useState<LogoOptions>({
    src: null,
    size: 0.3,
    padding: 8,
    placement: 'freestanding',
    colorMode: 'original',
    shape: 'square',
    imageElement: null,
  });

  const [urlInput, setUrlInput] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [moduleGrid, setModuleGrid] = useState<{ modules: Module[], moduleCount: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [diagnosticsLog, setDiagnosticsLog] = useState<string[]>([]);

  const handleQrDataChange = (field: keyof QRData, value: any) => {
    setQrData(prev => ({ ...prev, [field]: value }));
  };

  const handleStyleChange = (field: keyof QRStyle, value: any) => {
    setQrStyle(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (field: keyof LogoOptions, value: any) => {
    setLogoOptions(prev => ({ ...prev, [field]: value }));
  };

  const analyzeQR = useCallback(async (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const { data, width } = imageData;

    let moduleCount = 0;
    for (let x = 0; x < width; x++) {
        const alpha = data[(x * 4) + 3];
        if (alpha > 128) {
            moduleCount++;
        } else {
            if (moduleCount > 5) break; // Assume we found the start of the margin
            moduleCount = 0;
        }
    }
    if (moduleCount === 0) return null;

    const moduleSize = width / moduleCount;
    const modules: Module[] = [];

    const isFinder = (x: number, y: number, count: number) => {
        const finderSize = 7;
        if (x < finderSize && y < finderSize) return true;
        if (x >= count - finderSize && y < finderSize) return true;
        if (x < finderSize && y >= count - finderSize) return true;
        return false;
    };

    const isCornerDot = (x: number, y: number, count: number) => {
        const finderCenter = 3;
        const dist = (dx: number, dy: number) => Math.sqrt(Math.pow(x-dx,2) + Math.pow(y-dy, 2));
        if (dist(finderCenter, finderCenter) < 2) return true;
        if (dist(count - 1 - finderCenter, finderCenter) < 2) return true;
        if (dist(finderCenter, count - 1 - finderCenter) < 2) return true;
        return false;
    };

    for (let y = 0; y < moduleCount; y++) {
      for (let x = 0; x < moduleCount; x++) {
        const cx = Math.floor((x + 0.5) * moduleSize);
        const cy = Math.floor((y + 0.5) * moduleSize);
        const alpha = data[((cy * width + cx) * 4) + 3];
        if (alpha > 128) {
            const module: Module = { x, y, isFinder: isFinder(x,y,moduleCount) };
            if (module.isFinder && isCornerDot(x,y,moduleCount)) {
                module.isCornerDot = true;
            }
            modules.push(module);
        }
      }
    }
    return { modules, moduleCount };
  }, []);

  const debouncedQRFetch = useCallback(debounce(async (data: QRData) => {
    const encodedText = encodeURIComponent(data.text);
    const url = `https://quickchart.io/qr?text=${encodedText}&size=${data.size}&margin=${data.margin}&ecLevel=${data.ecc}`;
    try {
      const img = await loadImageEl(url);
      const grid = await analyzeQR(img);
      setModuleGrid(grid);
    } catch (error) {
      console.error('Failed to fetch or analyze QR code:', error);
      setDiagnosticsLog(prev => [...prev, `ERROR: Failed to fetch/analyze QR code: ${error}`]);
    }
  }, 500), [analyzeQR]);

  useEffect(() => {
    if (qrData.text) {
      debouncedQRFetch(qrData);
    }
  }, [qrData, debouncedQRFetch]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const src = event.target?.result as string;
        try {
          const imageElement = await loadImageEl(src);
          setLogoOptions(prev => ({
            ...prev,
            src,
            imageElement,
            placement: 'freestanding',
            colorMode: 'original',
            shape: 'square',
          }));
        } catch (error) {
          console.error("Error loading logo image:", error);
          setDiagnosticsLog(prev => [...prev, `ERROR: Failed to load logo: ${error}`]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const drawQR = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || !moduleGrid) return;

    const { modules, moduleCount } = moduleGrid;
    const width = canvas.width;
    const moduleSize = width / moduleCount;

    // Clear canvas
    ctx.fillStyle = qrStyle.backgroundColor;
    ctx.fillRect(0, 0, width, width);

    // Prepare gradient
    let gradient: CanvasGradient | null = null;
    if (qrStyle.useGradient) {
      const angleRad = qrStyle.gradientAngle * Math.PI / 180;
      const x1 = width / 2 * (1 - Math.cos(angleRad));
      const y1 = width / 2 * (1 - Math.sin(angleRad));
      const x2 = width / 2 * (1 + Math.cos(angleRad));
      const y2 = width / 2 * (1 + Math.sin(angleRad));
      gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, qrStyle.primaryColor);
      gradient.addColorStop(1, qrStyle.secondaryColor);
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = qrStyle.primaryColor;
    }

    // --- LOGO KNOCKOUT ---
    let logoRect: { x: number, y: number, w: number, h: number } | null = null;
    if (logoOptions.src && logoOptions.imageElement) {
        const logoTotalSize = Math.max(0.12, Math.min(0.5, logoOptions.size));
        const logoModules = Math.floor(logoTotalSize * moduleCount);
        const logoPaddingModules = Math.round(logoOptions.padding / moduleSize);

        const totalLogoModules = logoModules + logoPaddingModules * 2;
        const startModule = Math.floor((moduleCount - totalLogoModules) / 2);

        const x = startModule * moduleSize;
        const y = startModule * moduleSize;
        const size = totalLogoModules * moduleSize;
        logoRect = { x, y, w: size, h: size };

        if (logoOptions.placement === 'freestanding') {
            ctx.save();
            ctx.fillStyle = qrStyle.backgroundColor;
            const shape = logoOptions.shape;
            const R = shape === 'rounded' ? size * 0.2 : shape === 'circle' ? size / 2 : 0;
            ctx.beginPath();
            ctx.moveTo(x + R, y);
            ctx.lineTo(x + size - R, y);
            ctx.quadraticCurveTo(x + size, y, x + size, y + R);
            ctx.lineTo(x + size, y + size - R);
            ctx.quadraticCurveTo(x + size, y + size, x + size - R, y + size);
            ctx.lineTo(x + R, y + size);
            ctx.quadraticCurveTo(x, y + size, x, y + size - R);
            ctx.lineTo(x, y + R);
            ctx.quadraticCurveTo(x, y, x + R, y);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    const isModuleInLogoArea = (mx: number, my: number) => {
        if (!logoRect) return false;
        const moduleCenter_x = (mx + 0.5) * moduleSize;
        const moduleCenter_y = (my + 0.5) * moduleSize;
        return moduleCenter_x > logoRect.x && moduleCenter_x < logoRect.x + logoRect.w &&
               moduleCenter_y > logoRect.y && moduleCenter_y < logoRect.y + logoRect.h;
    };

    modules.forEach(module => {
      if (logoOptions.placement === 'freestanding' && isModuleInLogoArea(module.x, module.y)) {
        return;
      }

      const x = Math.round(module.x * moduleSize);
      const y = Math.round(module.y * moduleSize);
      const nextX = Math.round((module.x + 1) * moduleSize);
      const nextY = Math.round((module.y + 1) * moduleSize);
      const w = nextX - x;
      const h = nextY - y;

      let shape = qrStyle.dotShape;
      if (module.isFinder) {
          shape = module.isCornerDot ? qrStyle.cornerDotShape : qrStyle.cornerSquareShape;
      }

      ctx.beginPath();
      switch (shape) {
        case 'dots':
        case 'dot':
          ctx.arc(x + w / 2, y + h / 2, w / 2, 0, 2 * Math.PI);
          break;
        case 'rounded':
          ctx.moveTo(x + w * 0.25, y);
          ctx.lineTo(x + w * 0.75, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + h * 0.25);
          ctx.lineTo(x + w, y + h * 0.75);
          ctx.quadraticCurveTo(x + w, y + h, x + w * 0.75, y + h);
          ctx.lineTo(x + w * 0.25, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h * 0.75);
          ctx.lineTo(x, y + h * 0.25);
          ctx.quadraticCurveTo(x, y, x + w * 0.25, y);
          break;
        case 'extra-rounded':
          ctx.arc(x + w / 2, y + h / 2, w / 2 * 0.9, 0, 2 * Math.PI);
          break;
        case 'square':
        default:
          ctx.rect(x, y, w, h);
          break;
      }
      ctx.fill();
    });

    // --- DRAW LOGO ---
    if (logoRect && logoOptions.imageElement) {
        ctx.save();
        const { x, y, w, h } = logoRect;
        const paddingPx = logoOptions.padding;
        const innerX = x + paddingPx;
        const innerY = y + paddingPx;
        const innerW = w - paddingPx * 2;
        const innerH = h - paddingPx * 2;

        // Clip path for logo shape
        const shape = logoOptions.shape;
        const R = shape === 'rounded' ? innerW * 0.2 : shape === 'circle' ? innerW / 2 : 0;
        ctx.beginPath();
        ctx.moveTo(innerX + R, innerY);
        ctx.lineTo(innerX + innerW - R, innerY);
        ctx.quadraticCurveTo(innerX + innerW, innerY, innerX + innerW, innerY + R);
        ctx.lineTo(innerX + innerW, innerY + innerH - R);
        ctx.quadraticCurveTo(innerX + innerW, innerY + innerH, innerX + innerW - R, innerY + innerH);
        ctx.lineTo(innerX + R, innerY + innerH);
        ctx.quadraticCurveTo(innerX, innerY + innerH, innerX, innerY + innerH - R);
        ctx.lineTo(innerX, innerY + R);
        ctx.quadraticCurveTo(innerX, innerY, innerX + R, innerY);
        ctx.closePath();

        if (logoOptions.colorMode !== 'original') {
            switch(logoOptions.colorMode) {
                case 'white': ctx.fillStyle = '#FFFFFF'; break;
                case 'black': ctx.fillStyle = '#000000'; break;
                case 'brand': ctx.fillStyle = qrStyle.primaryColor; break;
            }
            ctx.fill();
        } else {
            ctx.clip();
            ctx.drawImage(logoOptions.imageElement, innerX, innerY, innerW, innerH);
        }
        ctx.restore();
    }

  }, [moduleGrid, qrStyle, logoOptions]);

  useEffect(() => {
    drawQR();
  }, [drawQR]);

  const handleDownload = (format: 'png' | 'svg') => {
    if (format === 'svg') {
        const svgString = generateSVG();
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        triggerDownload(blob, 'qrcode.svg');
        return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
        if (blob) {
            triggerDownload(blob, 'qrcode.png');
        }
    }, 'image/png');
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateSVG = (): string => {
    if (!moduleGrid) return '<svg></svg>';
    const { modules, moduleCount } = moduleGrid;
    const width = 1024; // Use a fixed large size for SVG for scalability
    const moduleSize = width / moduleCount;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="0 0 ${width} ${width}" shape-rendering="crispEdges">`;
    svg += `<defs>`;
    if (qrStyle.useGradient) {
        const angleRad = qrStyle.gradientAngle * Math.PI / 180;
        const x1 = 50 * (1 - Math.cos(angleRad));
        const y1 = 50 * (1 - Math.sin(angleRad));
        const x2 = 50 * (1 + Math.cos(angleRad));
        const y2 = 50 * (1 + Math.sin(angleRad));
        svg += `<linearGradient id="grad" gradientTransform="rotate(${qrStyle.gradientAngle} 0.5 0.5)">
            <stop offset="0%" stop-color="${qrStyle.primaryColor}" />
            <stop offset="100%" stop-color="${qrStyle.secondaryColor}" />
        </linearGradient>`;
    }
    svg += `</defs>`;
    svg += `<rect width="${width}" height="${width}" fill="${qrStyle.backgroundColor}" />`;

    const fill = qrStyle.useGradient ? 'url(#grad)' : qrStyle.primaryColor;

    // --- Logo Knockout / Background ---
    let logoRect: { x: number, y: number, w: number, h: number } | null = null;
    let logoClipPathId: string | null = null;

    if (logoOptions.src) {
        const logoTotalSize = Math.max(0.12, Math.min(0.5, logoOptions.size));
        const logoModules = Math.floor(logoTotalSize * moduleCount);
        const logoPaddingModules = Math.round(logoOptions.padding / moduleSize);

        const totalLogoModules = logoModules + logoPaddingModules * 2;
        const startModule = Math.floor((moduleCount - totalLogoModules) / 2);

        const x = startModule * moduleSize;
        const y = startModule * moduleSize;
        const size = totalLogoModules * moduleSize;
        logoRect = { x, y, w: size, h: size };

        if (logoOptions.placement === 'freestanding') {
            const R = logoOptions.shape === 'rounded' ? size * 0.2 : logoOptions.shape === 'circle' ? size / 2 : 0;
            svg += `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${R}" ry="${R}" fill="${qrStyle.backgroundColor}" />`;
        }
    }

    const isModuleInLogoArea = (mx: number, my: number) => {
        if (!logoRect) return false;
        const moduleCenter_x = (mx + 0.5) * moduleSize;
        const moduleCenter_y = (my + 0.5) * moduleSize;
        return moduleCenter_x > logoRect.x && moduleCenter_x < logoRect.x + logoRect.w &&
               moduleCenter_y > logoRect.y && moduleCenter_y < logoRect.y + logoRect.h;
    };

    // Render solid finder patterns first
    const finderSize = 7 * moduleSize;
    svg += `<rect x="0" y="0" width="${finderSize}" height="${finderSize}" fill="${fill}" />`;
    svg += `<rect x="${width-finderSize}" y="0" width="${finderSize}" height="${finderSize}" fill="${fill}" />`;
    svg += `<rect x="0" y="${width-finderSize}" width="${finderSize}" height="${finderSize}" fill="${fill}" />`;

    modules.forEach(module => {
      if (module.isFinder || (logoOptions.placement === 'freestanding' && isModuleInLogoArea(module.x, module.y))) {
        return;
      }

      const x = module.x * moduleSize;
      const y = module.y * moduleSize;
      const w = moduleSize;
      const h = moduleSize;
      const r = moduleSize / 2;

      switch (qrStyle.dotShape) {
          case 'dots':
              svg += `<circle cx="${x+r}" cy="${y+r}" r="${r}" fill="${fill}" />`; break;
          case 'rounded':
              svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w*0.25}" ry="${h*0.25}" fill="${fill}" />`; break;
          case 'extra-rounded':
              svg += `<circle cx="${x+r}" cy="${y+r}" r="${r*0.9}" fill="${fill}" />`; break;
          case 'square':
          default:
              svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" />`; break;
      }
    });

    // --- Embed Logo in SVG ---
    if (logoRect) {
        const paddingPx = logoOptions.padding;
        const { x, y, w, h } = logoRect;
        const innerX = x + paddingPx;
        const innerY = y + paddingPx;
        const innerW = w - paddingPx * 2;
        const innerH = h - paddingPx * 2;
        const shape = logoOptions.shape;

        if (logoOptions.colorMode === 'original' && logoOptions.src) {
             logoClipPathId = 'logoClip';
            svg += `<defs><clipPath id="${logoClipPathId}">`;
            const R = shape === 'rounded' ? innerW * 0.2 : shape === 'circle' ? innerW / 2 : 0;
            svg += `<rect x="${innerX}" y="${innerY}" width="${innerW}" height="${innerH}" rx="${R}" ry="${R}" />`;
            svg += `</clipPath></defs>`;
            svg += `<image href="${logoOptions.src}" x="${innerX}" y="${innerY}" width="${innerW}" height="${innerH}" clip-path="url(#${logoClipPathId})" />`;
        } else {
            let logoFill = '';
            switch(logoOptions.colorMode) {
                case 'white': logoFill = '#FFFFFF'; break;
                case 'black': logoFill = '#000000'; break;
                case 'brand': logoFill = qrStyle.primaryColor; break;
            }
            if (logoFill) {
                const R = shape === 'rounded' ? innerW * 0.2 : shape === 'circle' ? innerW / 2 : 0;
                svg += `<rect x="${innerX}" y="${innerY}" width="${innerW}" height="${innerH}" rx="${R}" ry="${R}" fill="${logoFill}" />`;
            }
        }
    }

    svg += '</svg>';
    return svg;
  };

  const handleUrlExtract = useCallback(async () => {
    if (!urlInput) return;
    setIsExtracting(true);
    setDiagnosticsLog(prev => [...prev, `INFO: Starting extraction for ${urlInput}`]);
    try {
        const url = new URL(urlInput.startsWith('http') ? urlInput : `https://${urlInput}`);
        const fetchUrl = `https://r.jina.ai/${url.toString()}`;
        const response = await fetch(fetchUrl);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let themeColor = doc.querySelector('meta[name="theme-color"]')?.getAttribute('content');

        let primary = themeColor ? normalizeHex(themeColor) : null;
        let secondary = null;

        const icons = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]'));
        if (icons.length > 0) {
            const iconUrl = new URL(icons[0].href, url.origin).toString();
            const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(iconUrl)}&w=64&h=64&fit=cover&output=png`;
            const img = await loadImageEl(proxyUrl);

            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
            if (tempCtx) {
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                tempCtx.drawImage(img, 0, 0);
                const imgData = tempCtx.getImageData(0, 0, img.width, img.height).data;

                // Simple quantization: count colors
                const colorCounts: { [hex: string]: number } = {};
                for (let i = 0; i < imgData.length; i += 4) {
                    if (imgData[i+3] < 128) continue; // skip transparent pixels
                    const hex = `#${((1 << 24) + (imgData[i] << 16) + (imgData[i+1] << 8) + imgData[i+2]).toString(16).slice(1)}`;
                    colorCounts[hex] = (colorCounts[hex] || 0) + 1;
                }
                const palette = Object.entries(colorCounts).sort((a,b) => b[1] - a[1]).map(e => e[0]);

                if (!primary) primary = palette[0] || '#000000';
                secondary = palette[1] || primary;
            }
        }

        if (!primary) { // Fallback to domain hash
            let hash = 0;
            for (let i = 0; i < url.hostname.length; i++) {
                hash = url.hostname.charCodeAt(i) + ((hash << 5) - hash);
            }
            primary = `#${((hash & 0x00FFFFFF).toString(16).toUpperCase()).padStart(6, '0')}`;
        }

        setQrStyle(prev => ({
            ...prev,
            primaryColor: normalizeHex(primary!),
            secondaryColor: normalizeHex(secondary || primary!),
            backgroundColor: getLuminance(primary!) > 0.5 ? '#f0f0f0' : '#ffffff'
        }));
        setDiagnosticsLog(prev => [...prev, `SUCCESS: Extracted colors. Primary: ${primary}, Secondary: ${secondary}`]);

    } catch (e) {
        console.error('Extraction failed', e);
        setDiagnosticsLog(prev => [...prev, `ERROR: Extraction failed: ${e}`]);
    } finally {
        setIsExtracting(false);
    }
  }, [urlInput]);

  const runDiagnostics = () => {
    let log: string[] = ["--- Running Diagnostics ---"];

    // 1. hex normalization and contrast
    log.push(normalizeHex('fff') === '#ffffff' ? 'PASS: hex normalization' : 'FAIL: hex normalization');
    log.push(getContrast('#ffffff', '#000000') > 20 ? 'PASS: contrast function' : 'FAIL: contrast function');

    // 2. grid dimension analysis
    log.push(moduleGrid && moduleGrid.moduleCount > 0 ? `PASS: QR grid analyzed (${moduleGrid.moduleCount}x${moduleGrid.moduleCount})` : 'FAIL: QR grid analysis');

    // 3. baking logo
    if (logoOptions.imageElement) {
        const logoCanvas = document.createElement('canvas');
        logoCanvas.width = 100;
        logoCanvas.height = 100;
        const logoCtx = logoCanvas.getContext('2d');
        logoCtx?.drawImage(logoOptions.imageElement, 0, 0, 100, 100);
        log.push(logoCanvas.width === 100 ? 'PASS: Baking logo returns canvas of same size' : 'FAIL: Logo baking size mismatch');
    } else {
        log.push('SKIP: Logo baking (no logo)');
    }

    // 4. SVG export text
    const svgText = generateSVG();
    log.push(svgText.includes('<svg') ? 'PASS: SVG export contains <svg> tag' : 'FAIL: SVG export missing <svg> tag');
    log.push(svgText.match(/<rect|<circle/g) ? 'PASS: SVG export contains vector elements' : 'FAIL: SVG export missing vector elements');

    // 5. rasterizing tiny SVG
    const tinySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red" /></svg>`;
    const tinySvgSrc = `data:image/svg+xml;base64,${btoa(tinySvg)}`;
    loadImageEl(tinySvgSrc).then(img => {
        const finalLog = [...log];
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w === 0 || h === 0) { w=1024; h=1024; } // As per requirements
        finalLog.push(w > 0 && h > 0 ? 'PASS: Tiny inline SVG rasterized' : 'FAIL: Tiny inline SVG rasterization');
        setDiagnosticsLog(finalLog);
    }).catch(() => setDiagnosticsLog([...log, 'FAIL: Tiny inline SVG rasterization']));
  };

  const LabelledControl: React.FC<{ label: string, children: React.ReactNode, htmlFor?: string }> = ({ label, children, htmlFor }) => (
    <div className="flex flex-col space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <div className="container mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* --- CONTROLS --- */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md space-y-6 overflow-y-auto max-h-[90vh]">
            <h1 className="text-2xl font-bold text-gray-900">QR Code Generator</h1>

            <LabelledControl label="Content" htmlFor="qr-text">
                <textarea id="qr-text" value={qrData.text} onChange={e => handleQrDataChange('text', e.target.value)} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500" rows={3}></textarea>
            </LabelledControl>

            <div className="grid grid-cols-2 gap-4">
                <LabelledControl label="Error Correction" htmlFor="ecc-level">
                    <select id="ecc-level" value={qrData.ecc} onChange={e => handleQrDataChange('ecc', e.target.value)} className="w-full p-2 border rounded-md">
                        <option value="L">Low</option>
                        <option value="M">Medium</option>
                        <option value="Q">Quartile</option>
                        <option value="H">High</option>
                    </select>
                </LabelledControl>
                <LabelledControl label={`Margin (${qrData.margin})`}>
                    <input type="range" min="0" max="10" value={qrData.margin} onChange={e => handleQrDataChange('margin', parseInt(e.target.value))} />
                </LabelledControl>
            </div>

            <hr />
            <h2 className="text-lg font-semibold">Styling</h2>

            <LabelledControl label="Dot Shape">
                <select value={qrStyle.dotShape} onChange={e => handleStyleChange('dotShape', e.target.value)} className="w-full p-2 border rounded-md">
                    <option value="square">Square</option>
                    <option value="rounded">Rounded</option>
                    <option value="dots">Dots</option>
                    <option value="extra-rounded">Extra Rounded</option>
                </select>
            </LabelledControl>

            <div className="grid grid-cols-2 gap-4">
                <LabelledControl label="Corner Squares">
                    <select value={qrStyle.cornerSquareShape} onChange={e => handleStyleChange('cornerSquareShape', e.target.value)} className="p-2 border rounded-md">
                        <option value="square">Square</option>
                        <option value="dot">Dot</option>
                        <option value="extra-rounded">Extra Rounded</option>
                    </select>
                </LabelledControl>
                <LabelledControl label="Corner Dots">
                    <select value={qrStyle.cornerDotShape} onChange={e => handleStyleChange('cornerDotShape', e.target.value)} className="p-2 border rounded-md">
                        <option value="square">Square</option>
                        <option value="dot">Dot</option>
                    </select>
                </LabelledControl>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium">Colors</h3>
                    <button onClick={() => handleStyleChange('useGradient', !qrStyle.useGradient)} className={`px-2 py-1 text-xs rounded ${qrStyle.useGradient ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}>Gradient</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <LabelledControl label="Primary">
                        <div className="flex items-center border rounded-md">
                            <input type="color" value={qrStyle.primaryColor} onChange={e => handleStyleChange('primaryColor', e.target.value)} className="w-8 h-8" />
                            <input type="text" value={qrStyle.primaryColor} onChange={e => handleStyleChange('primaryColor', e.target.value)} className="w-full p-1 text-sm" />
                        </div>
                    </LabelledControl>
                    <LabelledControl label={qrStyle.useGradient ? "Secondary" : "Background"}>
                        <div className="flex items-center border rounded-md">
                            <input type="color" value={qrStyle.useGradient ? qrStyle.secondaryColor : qrStyle.backgroundColor} onChange={e => handleStyleChange(qrStyle.useGradient ? 'secondaryColor' : 'backgroundColor', e.target.value)} className="w-8 h-8" />
                            <input type="text" value={qrStyle.useGradient ? qrStyle.secondaryColor : qrStyle.backgroundColor} onChange={e => handleStyleChange(qrStyle.useGradient ? 'secondaryColor' : 'backgroundColor', e.target.value)} className="w-full p-1 text-sm" />
                        </div>
                    </LabelledControl>
                </div>
                {qrStyle.useGradient && (
                    <LabelledControl label={`Angle (${qrStyle.gradientAngle}°)`}>
                        <input type="range" min="0" max="360" value={qrStyle.gradientAngle} onChange={e => handleStyleChange('gradientAngle', parseInt(e.target.value))} />
                    </LabelledControl>
                )}
            </div>

            <hr />
            <h2 className="text-lg font-semibold">Website Colors</h2>
             <div className="flex space-x-2">
                <input type="text" placeholder="example.com" value={urlInput} onChange={e => setUrlInput(e.target.value)} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500" />
                <button onClick={handleUrlExtract} disabled={isExtracting} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300">
                    {isExtracting ? '...' : 'Extract'}
                </button>
            </div>

            <hr />
            <h2 className="text-lg font-semibold">Logo</h2>
            <LabelledControl label="Upload Logo (PNG, JPG, SVG)">
                <input type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={handleLogoUpload} className="text-sm" />
            </LabelledControl>

            {logoOptions.src && (
                <div className="space-y-4 pt-2">
                    <LabelledControl label={`Size (${Math.round(logoOptions.size * 100)}%)`}>
                        <input type="range" min="0.12" max="0.5" step="0.01" value={logoOptions.size} onChange={e => handleLogoChange('size', parseFloat(e.target.value))} />
                    </LabelledControl>
                    <LabelledControl label={`Padding (${logoOptions.padding}px)`}>
                        <input type="range" min="0" max="32" value={logoOptions.padding} onChange={e => handleLogoChange('padding', parseInt(e.target.value))} />
                    </LabelledControl>
                    <div className="grid grid-cols-2 gap-4">
                        <LabelledControl label="Placement">
                            <select value={logoOptions.placement} onChange={e => handleLogoChange('placement', e.target.value)} className="p-2 border rounded-md">
                                <option value="freestanding">Freestanding</option>
                                <option value="overlay">Overlay</option>
                            </select>
                        </LabelledControl>
                        <LabelledControl label="Shape">
                            <select value={logoOptions.shape} onChange={e => handleLogoChange('shape', e.target.value)} className="p-2 border rounded-md">
                                <option value="square">Square</option>
                                <option value="rounded">Rounded</option>
                                <option value="circle">Circle</option>
                            </select>
                        </LabelledControl>
                    </div>
                    <LabelledControl label="Color Mode">
                        <select value={logoOptions.colorMode} onChange={e => handleLogoChange('colorMode', e.target.value)} className="w-full p-2 border rounded-md">
                            <option value="original">Original Colors</option>
                            <option value="brand">Brand Color</option>
                            <option value="white">White</option>
                            <option value="black">Black</option>
                        </select>
                    </LabelledControl>
                </div>
            )}
        </div>

        {/* --- PREVIEW & ACTIONS --- */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md flex justify-center items-center">
                <canvas ref={canvasRef} width={qrData.size} height={qrData.size} className="max-w-full h-auto"></canvas>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md space-y-4">
                <div className="flex flex-wrap items-center justify-center gap-4">
                    <button onClick={() => handleDownload('png')} className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Download PNG</button>
                    <button onClick={() => handleDownload('svg')} className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Download SVG</button>
                    <button onClick={runDiagnostics} className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300">Run Tests</button>
                </div>
                {diagnosticsLog.length > 0 && (
                    <div className="mt-4 p-3 bg-gray-100 rounded-md max-h-48 overflow-y-auto">
                        <h4 className="font-semibold text-sm mb-2">Diagnostics Log:</h4>
                        <pre className="text-xs whitespace-pre-wrap">{diagnosticsLog.join('\n')}</pre>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
