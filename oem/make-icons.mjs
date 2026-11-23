#!/usr/bin/env node
// 网脉智能体图标生成器：纯 Node（zlib 手写 PNG/ICO/ICNS），无第三方依赖。
//   node oem/make-icons.mjs
// 设计：深海军蓝圆角块 + 青色脉冲波形 + 三个网脉节点。

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

// ---------- 颜色工具 ----------
const hex = function (h) {
  return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]
}
const C = {
  bgA: hex('#0A1626'),
  bgB: hex('#17466B'),
  glowC: hex('#2FB8FF'),
  lineA: hex('#63E8FF'),
  lineB: hex('#2B8DFF'),
  dot: hex('#BFF4FF'),
  dotDim: hex('#3FC9F2')
}
const LIGHT = {
  bgA: hex('#FFFFFF'),
  bgB: hex('#E4EDF8'),
  glowC: hex('#5FB0F0'),
  lineA: hex('#0E4E86'),
  lineB: hex('#1E7FD6'),
  dot: hex('#0A2E52'),
  dotDim: hex('#1E7FD6')
}

const lerp = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] }
const clamp01 = function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v) }

// ---------- 形状 ----------
function sdRoundBox(px, py, hw, hh, r) {
  const qx = Math.abs(px) - hw + r
  const qy = Math.abs(py) - hh + r
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r
}

function sdSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const len2 = vx * vx + vy * vy
  let t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0
  t = clamp01(t)
  const dx = wx - vx * t
  const dy = wy - vy * t
  return Math.sqrt(dx * dx + dy * dy)
}

function sdPolyline(px, py, pts) {
  let best = 1e9
  for (let i = 0; i < pts.length - 1; i++) {
    const d = sdSegment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])
    if (d < best) best = d
  }
  return best
}

// 脉冲波形（单位坐标）
const PULSE = [[0.115, 0.565], [0.345, 0.565], [0.425, 0.335], [0.515, 0.745], [0.600, 0.455], [0.665, 0.565], [0.885, 0.565]]
const NODES = [[0.115, 0.565, 0.030], [0.5, 0.235, 0.034], [0.885, 0.565, 0.030]]

// ---------- 着色：返回 0..1 的 rgba ----------
function shade(u, v, px, palette, opts) {
  const design = opts.glyphOnly ? { u: (u - 0.5) / opts.scale + 0.5, v: (v - 0.5) / opts.scale + 0.5 } : { u: u, v: v }
  const x = design.u
  const y = design.v
  let out = [0, 0, 0, 0]

  if (!opts.glyphOnly) {
    const d = sdRoundBox(x - 0.5, y - 0.5, 0.5, 0.5, opts.radius)
    const cov = clamp01(0.5 - d / px)
    if (cov <= 0) return out
    let base = lerp(palette.bgA, palette.bgB, clamp01((x + y) * 0.5))
    const hl = clamp01(1 - Math.sqrt((x - 0.26) * (x - 0.26) + (y - 0.18) * (y - 0.18)) / 0.62)
    base = lerp(base, [0.42, 0.72, 0.92], hl * hl * 0.22)
    out = [base[0], base[1], base[2], cov]
  }

  const within = x > -0.02 && x < 1.02 && y > -0.02 && y < 1.02
  if (!within) return out

  const blend = function (rgb, alpha) {
    const a = clamp01(alpha)
    if (a <= 0) return
    const inv = 1 - a
    out[0] = rgb[0] * a + out[0] * inv
    out[1] = rgb[1] * a + out[1] * inv
    out[2] = rgb[2] * a + out[2] * inv
    out[3] = Math.max(out[3], a)
  }

  // 光晕
  const dPulse = sdPolyline(x, y, PULSE)
  const glowCov = clamp01((opts.glowWidth - dPulse) / px)
  if (glowCov > 0) blend(palette.glowC, glowCov * 0.20)

  // 主脉冲线
  const lineCov = clamp01((opts.strokeWidth - dPulse) / px)
  if (lineCov > 0) {
    const t = clamp01((x - 0.1) / 0.8)
    blend(lerp(palette.lineA, palette.lineB, t), lineCov)
  }

  // 节点
  for (const n of NODES) {
    const dn = Math.sqrt((x - n[0]) * (x - n[0]) + (y - n[1]) * (y - n[1])) - n[2]
    const cov = clamp01(-dn / px)
    if (cov <= 0) continue
    const isMid = n[1] < 0.3
    blend(isMid ? palette.dot : palette.dotDim, cov)
    if (!opts.glyphOnly && isMid) {
      const halo = clamp01((0.085 - (dn + n[2])) / px)
      if (halo > 0) blend(palette.glowC, halo * 0.25)
    }
  }

  return out
}

function render(size, palette, opts) {
  const px = 1 / size
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rgba = shade((x + 0.5) / size, (y + 0.5) / size, px, palette, opts)
      const i = (y * size + x) * 4
      buf[i] = Math.round(clamp01(rgba[0]) * 255)
      buf[i + 1] = Math.round(clamp01(rgba[1]) * 255)
      buf[i + 2] = Math.round(clamp01(rgba[2]) * 255)
      buf[i + 3] = Math.round(clamp01(rgba[3]) * 255)
    }
  }
  return buf
}

// ---------- PNG ----------
const CRC_TABLE = (function () {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))])
}

// ---------- ICO ----------
function encodeIco(entries) {
  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)
  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  entries.forEach(function (e, i) {
    const o = i * 16
    dir[o] = e.size >= 256 ? 0 : e.size
    dir[o + 1] = e.size >= 256 ? 0 : e.size
    dir[o + 2] = 0
    dir[o + 3] = 0
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(e.png.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += e.png.length
  })
  return Buffer.concat([header, dir].concat(entries.map(function (e) { return e.png })))
}

// ---------- ICNS ----------
function encodeIcns(entries) {
  const chunks = entries.map(function (e) {
    const head = Buffer.alloc(8)
    head.write(e.type, 0, 4, 'ascii')
    head.writeUInt32BE(e.png.length + 8, 4)
    return Buffer.concat([head, e.png])
  })
  const head = Buffer.alloc(8)
  head.write('icns', 0, 4, 'ascii')
  const total = 8 + chunks.reduce(function (s, c) { return s + c.length }, 0)
  head.writeUInt32BE(total, 4)
  return Buffer.concat([head].concat(chunks))
}

// ---------- 写文件 ----------
function writePng(absPath, size) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  const png = encodePng(size, render(size, C, { radius: 0.225, strokeWidth: 0.052, glowWidth: 0.13, glyphOnly: false }))
  fs.writeFileSync(absPath, png)
  return png
}

function writeForeground(absPath, size) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  const png = encodePng(size, render(size, C, { radius: 0.225, strokeWidth: 0.075, glowWidth: 0.16, glyphOnly: true, scale: 0.72 }))
  fs.writeFileSync(absPath, png)
  return png
}

function writeMonochrome(absPath, size) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  const mono = { bgA: [1, 1, 1], bgB: [1, 1, 1], glowC: [1, 1, 1], lineA: [1, 1, 1], lineB: [1, 1, 1], dot: [1, 1, 1], dotDim: [1, 1, 1] }
  const png = encodePng(size, render(size, mono, { radius: 0.225, strokeWidth: 0.075, glowWidth: 0.001, glyphOnly: true, scale: 0.72 }))
  fs.writeFileSync(absPath, png)
  return png
}

const ICONS = path.join(ROOT, 'desktop', 'src-tauri', 'icons')
const written = []

// 主图标
for (const s of [32, 64, 128, 256, 512, 1024]) {
  const target = s === 1024 ? path.join(ICONS, 'icon.png')
    : s === 256 ? path.join(ICONS, '128x128@2x.png')
    : s === 128 ? path.join(ICONS, '128x128.png')
    : path.join(ICONS, s + 'x' + s + '.png')
  writePng(target, s)
  written.push(path.relative(ROOT, target))
}
writePng(path.join(ICONS, '256x256.png'), 256)
written.push('desktop/src-tauri/icons/256x256.png')

// Windows Store 方块图标
for (const s of [30, 44, 71, 89, 107, 142, 150, 284, 310]) {
  writePng(path.join(ICONS, 'Square' + s + 'x' + s + 'Logo.png'), s)
  written.push('desktop/src-tauri/icons/Square' + s + 'x' + s + 'Logo.png')
}
writePng(path.join(ICONS, 'StoreLogo.png'), 50)
written.push('desktop/src-tauri/icons/StoreLogo.png')

// iOS AppIcon
const IOS = path.join(ICONS, 'ios')
const iosSizes = [
  ['AppIcon-20x20@1x.png', 20], ['AppIcon-20x20@2x.png', 40], ['AppIcon-20x20@2x-1.png', 40], ['AppIcon-20x20@3x.png', 60],
  ['AppIcon-29x29@1x.png', 29], ['AppIcon-29x29@2x.png', 58], ['AppIcon-29x29@2x-1.png', 58], ['AppIcon-29x29@3x.png', 87],
  ['AppIcon-40x40@1x.png', 40], ['AppIcon-40x40@2x.png', 80], ['AppIcon-40x40@2x-1.png', 80], ['AppIcon-40x40@3x.png', 120],
  ['AppIcon-60x60@2x.png', 120], ['AppIcon-60x60@3x.png', 180],
  ['AppIcon-76x76@1x.png', 76], ['AppIcon-76x76@2x.png', 152],
  ['AppIcon-83.5x83.5@2x.png', 167], ['AppIcon-512@2x.png', 1024]
]
for (const item of iosSizes) {
  writePng(path.join(IOS, item[0]), item[1])
  written.push('desktop/src-tauri/icons/ios/' + item[0])
}

// Android launcher
const DENSITY = [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]]
for (const d of DENSITY) {
  writePng(path.join(ICONS, 'android', 'mipmap-' + d[0], 'ic_launcher.png'), d[1])
  writePng(path.join(ICONS, 'android', 'mipmap-' + d[0], 'ic_launcher_round.png'), d[1])
  writeForeground(path.join(ICONS, 'android', 'mipmap-' + d[0], 'ic_launcher_foreground.png'), d[2])
  written.push('desktop/src-tauri/icons/android/mipmap-' + d[0] + '/ic_launcher*.png')
}

// ICO / ICNS
const icoEntries = [16, 24, 32, 48, 64, 128, 256].map(function (s) {
  return { size: s, png: encodePng(s, render(s, C, { radius: 0.225, strokeWidth: 0.052, glowWidth: 0.13, glyphOnly: false })) }
})
fs.writeFileSync(path.join(ICONS, 'icon.ico'), encodeIco(icoEntries))
written.push('desktop/src-tauri/icons/icon.ico')

const icnsEntries = [
  ['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024],
  ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]
].map(function (e) {
  return { type: e[0], png: encodePng(e[1], render(e[1], C, { radius: 0.225, strokeWidth: 0.052, glowWidth: 0.13, glyphOnly: false })) }
})
fs.writeFileSync(path.join(ICONS, 'icon.icns'), encodeIcns(icnsEntries))
written.push('desktop/src-tauri/icons/icon.icns')

// 桌面/文档/移动端
const big = function (absPath, palette, size) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  const png = encodePng(size, render(size, palette, { radius: 0.225, strokeWidth: 0.052, glowWidth: 0.13, glyphOnly: false }))
  fs.writeFileSync(absPath, png)
  written.push(path.relative(ROOT, absPath))
}

big(path.join(ROOT, 'desktop', 'public', 'app-icon.png'), C, 1024)
big(path.join(ROOT, 'desktop', 'src-tauri', 'app-icon.png'), C, 1024)
big(path.join(ROOT, 'docs', 'images', 'app-icon.png'), C, 1024)
big(path.join(ROOT, 'docs', 'images', 'app-icon-dark.png'), C, 512)
big(path.join(ROOT, 'docs', 'images', 'app-icon-light.png'), LIGHT, 512)
big(path.join(ROOT, 'mobile', 'assets', 'icon.png'), C, 1024)
big(path.join(ROOT, 'mobile', 'assets', 'icon-ios.png'), C, 1024)
big(path.join(ROOT, 'mobile', 'assets', 'splash-icon.png'), C, 1024)
big(path.join(ROOT, 'mobile', 'assets', 'favicon.png'), C, 64)
big(path.join(ROOT, 'mobile', 'assets', 'android-icon-background.png'), C, 512)
writeForeground(path.join(ROOT, 'mobile', 'assets', 'android-icon-foreground.png'), 512)
written.push('mobile/assets/android-icon-foreground.png')
writeMonochrome(path.join(ROOT, 'mobile', 'assets', 'android-icon-monochrome.png'), 512)
written.push('mobile/assets/android-icon-monochrome.png')

// ---------- SVG ----------
function buildSvg(palette, opts) {
  const pts = PULSE.map(function (p) { return (p[0] * 1024).toFixed(1) + ',' + (p[1] * 1024).toFixed(1) }).join(' ')
  const circles = NODES.map(function (n) {
    const fill = n[1] < 0.3 ? palette.dot : palette.dotDim
    return '  <circle cx="' + (n[0] * 1024).toFixed(1) + '" cy="' + (n[1] * 1024).toFixed(1) + '" r="' + (n[2] * 1024).toFixed(1) + '" fill="' + fill + '"/>'
  }).join('\n')
  const bg = opts.bg
    ? '  <defs>\n    <linearGradient id="bgg" x1="0" y1="0" x2="1" y2="1">\n      <stop offset="0" stop-color="' + palette.bgA + '"/>\n      <stop offset="1" stop-color="' + palette.bgB + '"/>\n    </linearGradient>\n    <linearGradient id="lng" x1="0" y1="0" x2="1" y2="0">\n      <stop offset="0" stop-color="' + palette.lineA + '"/>\n      <stop offset="1" stop-color="' + palette.lineB + '"/>\n    </linearGradient>\n  </defs>\n  <rect width="1024" height="1024" rx="230" fill="url(#bgg)"/>\n'
    : '  <defs>\n    <linearGradient id="lng" x1="0" y1="0" x2="1" y2="0">\n      <stop offset="0" stop-color="' + palette.lineA + '"/>\n      <stop offset="1" stop-color="' + palette.lineB + '"/>\n    </linearGradient>\n  </defs>\n'
  return '<svg viewBox="0 0 1024 1024" width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">\n' + bg +
    '  <polyline points="' + pts + '" fill="none" stroke="url(#lng)" stroke-width="53" stroke-linecap="round" stroke-linejoin="round"/>\n' +
    circles + '\n</svg>\n'
}

const svgMain = buildSvg({ bgA: '#0A1626', bgB: '#17466B', lineA: '#63E8FF', lineB: '#2B8DFF', dot: '#BFF4FF', dotDim: '#3FC9F2' }, { bg: true })
const svgLight = buildSvg({ bgA: '#FFFFFF', bgB: '#E4EDF8', lineA: '#0E4E86', lineB: '#1E7FD6', dot: '#0A2E52', dotDim: '#1E7FD6' }, { bg: true })
const svgGlyph = buildSvg({ bgA: '#000000', bgB: '#000000', lineA: '#63E8FF', lineB: '#2B8DFF', dot: '#BFF4FF', dotDim: '#3FC9F2' }, { bg: false })
for (const p of ['desktop/public/app-icon.svg', 'desktop/src-tauri/app-icon.svg', 'desktop/src-tauri/app-icon-macos.svg', 'docs/images/app-icon.svg', 'docs/images/app-icon-dark.svg']) {
  fs.writeFileSync(path.join(ROOT, p), svgMain)
  written.push(p)
}
fs.writeFileSync(path.join(ROOT, 'docs/images/app-icon-light.svg'), svgLight)
written.push('docs/images/app-icon-light.svg')

console.log('生成完成，共 ' + written.length + ' 个文件')
