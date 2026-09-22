#!/usr/bin/env python3
"""Render a Specy metamodel diagram as SVG, in the style of specy-DDD-metamodel.svg.

Style (shared with the hand-built DDD diagram): #EBEBEB background inside a dashed frame,
a white title card in EB Garamond Bold, #FBFBFB nodes with #1B2935 ink and IBM Plex Sans
Condensed labels (Bold) / subtitles (Regular), "sloppy" double-stroked #E46765 connectors,
and the specy.ai logo at the bottom-left, linked to https://specy.ai.

Fonts are subsetted to the glyphs actually used and embedded as woff2 so the SVG is
self-contained (renders on GitHub, in editors, in browsers).  The website build
(specy.ai/scripts/build-metamodel-diagram.py) strips them again and turns every
<g class="node" data-anchor="..."> into a link to the matching section of the page.
"""
import base64
import io
import math
import os
import random
import re
import sys

# ----------------------------------------------------------------------------- style
W_DEFAULT, H_DEFAULT = 2618, 1420
BG, BOX_FILL, INK, RED, TITLE_INK = "#ebebeb", "#fbfbfb", "#1b2935", "#e46765", "#1c2631"
HUB_SIZE, NODE_SIZE, SUB_SIZE, CARD_SIZE, TITLE_SIZE = 45.1, 28.65, 21.5, 28.65, 63.1
PAD_X = 24               # horizontal padding inside a box
BOX_R = 7.5              # corner radius (DDD boxes)

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.environ.get("SPECY_FONT_DIR", os.path.join(HERE, ".fonts"))
FONT_FILES = {  # class → (family, weight, file)
    "b": ("IBM Plex Sans Condensed", 700, "IBMPlexSansCondensed-Bold.ttf"),
    "r": ("IBM Plex Sans Condensed", 400, "IBMPlexSansCondensed-Regular.ttf"),
    "t": ("EB Garamond", 700, "EBGaramond-Bold.ttf"),
}
FALLBACK_ADVANCE = {"b": 0.50, "r": 0.46, "t": 0.48}  # em per char when no font is available


# ----------------------------------------------------------------------------- fonts
class Font:
    def __init__(self, cls):
        self.cls = cls
        self.family, self.weight, fname = FONT_FILES[cls]
        self.path = os.path.join(FONT_DIR, fname)
        self.tt = None
        if os.path.exists(self.path):
            try:
                from fontTools.ttLib import TTFont
                self.tt = TTFont(self.path)
                self.cmap = self.tt.getBestCmap()
                self.hmtx = self.tt["hmtx"]
                self.upem = self.tt["head"].unitsPerEm
            except ImportError:
                self.tt = None
        self.used = set()

    def width(self, text, size, letter_spacing=0.0):
        self.used.update(text)
        if self.tt is None:
            return len(text) * size * FALLBACK_ADVANCE[self.cls] + letter_spacing * max(len(text) - 1, 0)
        total = 0
        for ch in text:
            g = self.cmap.get(ord(ch)) or self.cmap.get(ord("?"))
            total += self.hmtx[g][0] if g else self.upem * 0.5
        return total / self.upem * size + letter_spacing * max(len(text) - 1, 0)

    def embedded_face(self):
        """@font-face rule with the used glyphs subsetted and embedded as woff2, or ''."""
        if self.tt is None or not self.used:
            return ""
        from fontTools import subset
        from fontTools.ttLib import TTFont
        font = TTFont(self.path)
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.desubroutinize = True
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        opts.layout_features = ["kern", "liga"]
        sub = subset.Subsetter(options=opts)
        sub.populate(text="".join(sorted(self.used)) + " ?")
        sub.subset(font)
        buf = io.BytesIO()
        font.flavor = "woff2"
        font.save(buf)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return ("@font-face{font-family:'%s';font-weight:%d;font-style:normal;"
                "src:url(data:font/woff2;base64,%s) format('woff2')}" % (self.family, self.weight, b64))


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ----------------------------------------------------------------------------- model
class Box:
    def __init__(self, id, x, y, label, w=None, sub=None, kind="node", anchor=None):
        self.id, self.x, self.y, self.kind, self.anchor = id, x, y, kind, anchor or id
        self.label_lines = label.split("\n")
        self.w = w
        self.sub_src = [] if sub is None else ([sub] if isinstance(sub, str) else list(sub))
        self.sub_lines = []
        self.h = 0

    # -- geometry helpers
    @property
    def x1(self): return self.x + self.w
    @property
    def y1(self): return self.y + self.h
    @property
    def cx(self): return self.x + self.w / 2
    @property
    def cy(self): return self.y + self.h / 2

    def port(self, side, t=0.5):
        """A point on the box outline. t is the position along the side (0..1)."""
        if side == "left":   return (self.x, self.y + self.h * t)
        if side == "right":  return (self.x1, self.y + self.h * t)
        if side == "top":    return (self.x + self.w * t, self.y)
        if side == "bottom": return (self.x + self.w * t, self.y1)
        raise ValueError(side)


class Edge:
    def __init__(self, src, dst, card=None, src_side="right", dst_side="left", src_t=0.5, dst_t=0.5,
                 card_at="dst", straight=False, src_card=None):
        self.src, self.dst, self.card = src, dst, card
        self.src_side, self.dst_side, self.src_t, self.dst_t = src_side, dst_side, src_t, dst_t
        self.card_at, self.straight, self.src_card = card_at, straight, src_card


class Diagram:
    def __init__(self, title_lines, svg_title, width=W_DEFAULT, height=H_DEFAULT, seed=7):
        self.title_lines, self.svg_title = title_lines, svg_title
        self.W, self.H = width, height
        self.boxes, self.edges = {}, []
        self.rng = random.Random(seed)
        self.fonts = {c: Font(c) for c in FONT_FILES}

    def box(self, *a, **k):
        b = Box(*a, **k)
        assert b.id not in self.boxes, "duplicate box id %s" % b.id
        self.boxes[b.id] = b
        return b

    def edge(self, *a, **k):
        e = Edge(*a, **k)
        self.edges.append(e)
        return e

    def row(self, ids, x, gap=25):
        """Lay out boxes side by side starting at x (their y is kept). Returns the right edge."""
        self._measure()
        for i in ids:
            b = self.boxes[i]
            b.x = x
            x = b.x + b.w + gap
        return x - gap

    def stack(self, ids, y, gap=40):
        """Lay out boxes top to bottom starting at y (their x is kept). Returns the bottom edge."""
        self._measure()
        for i in ids:
            b = self.boxes[i]
            b.y = y
            y = b.y + b.h + gap
        return y - gap

    # -- text measurement / layout
    def _wrap(self, text, font, size, max_w):
        words, lines, cur = text.split(), [], ""
        for w in words:
            cand = (cur + " " + w).strip()
            if cur and font.width(cand, size) > max_w:
                lines.append(cur); cur = w
            else:
                cur = cand
        if cur: lines.append(cur)
        return lines

    def _measure(self):
        fb, fr = self.fonts["b"], self.fonts["r"]
        for b in self.boxes.values():
            lsize = HUB_SIZE if b.kind == "hub" else NODE_SIZE
            label_w = max(fb.width(l, lsize) for l in b.label_lines)
            if b.w is None:
                sub_w = max([fr.width(s, SUB_SIZE) for s in b.sub_src] or [0])
                b.w = math.ceil(max(label_w, sub_w) + 2 * PAD_X)
            elif label_w + 24 > b.w:
                sys.exit("label '%s' does not fit in width %d" % (b.label_lines[0], b.w))
            b.sub_lines = []
            for s in b.sub_src:
                b.sub_lines += self._wrap(s, fr, SUB_SIZE, b.w - 2 * PAD_X)
            L, S = len(b.label_lines), len(b.sub_lines)
            # Vertical rhythm measured on the DDD diagram: node label baseline at +44 (h 68),
            # +28 per subtitle line; hub label baseline at +64 (h 82), +54 per extra label line.
            if b.kind == "hub":
                b.label_y0, b.label_dy, b.sub_gap, b.sub_dy = (64 if L == 1 else 47) - (3 if S else 0), 54, 33, 28
                last_label = b.label_y0 + b.label_dy * (L - 1)
                b.h = last_label + (18 if L == 1 else 26) if not S else last_label + b.sub_gap + b.sub_dy * (S - 1) + 14
            else:
                b.label_y0, b.label_dy, b.sub_gap, b.sub_dy = 44 - 4 * max(S - 1, 0), 34, 28, 28
                last_label = b.label_y0 + b.label_dy * (L - 1)
                b.h = last_label + 24 if not S else last_label + b.sub_gap + b.sub_dy * (S - 1) + 18
        for l in self.title_lines:
            self.fonts["t"].width(l, TITLE_SIZE)

    # -- rendering pieces
    @staticmethod
    def _box_path(x, y, w, h, r=BOX_R):
        # same construction as the DDD diagram: M at (x+r, y), rounded corners as quadratic curves
        return ("M%g,%g Q%g,%g %g,%g L%g,%g Q%g,%g %g,%g L%g,%g Q%g,%g %g,%g L%g,%g Q%g,%g %g,%g Z" % (
            x + r, y, x, y, x, y + r, x, y + h - r, x, y + h, x + r, y + h, x + w - r, y + h,
            x + w, y + h, x + w, y + h - r, x + w, y + r, x + w, y, x + w - r, y))

    def _bezier(self, e):
        s, d = self.boxes[e.src], self.boxes[e.dst]
        p0, p3 = s.port(e.src_side, e.src_t), d.port(e.dst_side, e.dst_t)
        if e.straight:
            return p0, p0, p3, p3
        dist = math.hypot(p3[0] - p0[0], p3[1] - p0[1])
        k = min(0.55 * dist, 260)
        out = {"left": (-1, 0), "right": (1, 0), "top": (0, -1), "bottom": (0, 1)}
        v0, v3 = out[e.src_side], out[e.dst_side]
        p1 = (p0[0] + v0[0] * k, p0[1] + v0[1] * k)
        p2 = (p3[0] + v3[0] * k, p3[1] + v3[1] * k)
        return p0, p1, p2, p3

    def _rough_path(self, p0, p1, p2, p3, amp):
        """Sample the cubic and perturb it: Excalidraw-like hand-drawn stroke."""
        length = math.hypot(p3[0] - p0[0], p3[1] - p0[1]) + math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 0.3
        n = max(6, int(length / 14))
        rng = self.rng
        phase, freq = rng.uniform(0, 2 * math.pi), rng.uniform(1.0, 2.2)
        bias = rng.uniform(-amp, amp)
        pts = []
        for i in range(n + 1):
            t = i / n
            mt = 1 - t
            x = mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t ** 3 * p3[0]
            y = mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t ** 3 * p3[1]
            # tangent → normal
            dx = 3 * mt * mt * (p1[0] - p0[0]) + 6 * mt * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
            dy = 3 * mt * mt * (p1[1] - p0[1]) + 6 * mt * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
            nrm = math.hypot(dx, dy) or 1
            nx, ny = -dy / nrm, dx / nrm
            env = math.sin(math.pi * t)  # pinned at both ends
            off = env * (bias + amp * math.sin(2 * math.pi * freq * t + phase) + rng.gauss(0, amp * 0.35))
            pts.append((x + nx * off, y + ny * off))
        return "M" + " L".join("%.1f,%.1f" % p for p in pts)

    def _edge_svg(self, e):
        p0, p1, p2, p3 = self._bezier(e)
        out = []
        for amp, sw, op in ((1.6, 2.4, 0.95), (2.2, 1.7, 0.75)):
            out.append('<path class="c" stroke-width="%g" stroke-opacity="%g" d="%s"/>'
                       % (sw, op, self._rough_path(p0, p1, p2, p3, amp)))
        return "\n".join(out)

    def _card_svg(self, e):
        out = []
        fr = self.fonts["r"]
        for text, at in ((e.card, e.card_at), (e.src_card, "src")):
            if not text:
                continue
            b = self.boxes[e.dst if at == "dst" else e.src]
            side = e.dst_side if at == "dst" else e.src_side
            t = e.dst_t if at == "dst" else e.src_t
            px, py = b.port(side, t)
            w = fr.width(text, CARD_SIZE)
            if side == "left":    x, y, anchor = px - 9, py - 8, "end"
            elif side == "right": x, y, anchor = px + 9, py - 8, "start"
            elif side == "top":   x, y, anchor = px + 10, py - 10, "start"
            else:                 x, y, anchor = px + 10, py + 32, "start"
            out.append('<text class="r" font-size="%g" text-anchor="%s" x="%.1f" y="%.1f">%s</text>'
                       % (CARD_SIZE, anchor, x, y, esc(text)))
        return "\n".join(out)

    def _box_svg(self, b):
        lsize = HUB_SIZE if b.kind == "hub" else NODE_SIZE
        parts = ['<g class="node" data-anchor="%s" data-label="%s">' % (esc(b.anchor), esc(" ".join(b.label_lines)))]
        parts.append('<path fill="%s" stroke="%s" stroke-width="2" d="%s"/>' % (BOX_FILL, INK, self._box_path(b.x, b.y, b.w, b.h)))
        y = b.y + b.label_y0
        for l in b.label_lines:
            parts.append('<text class="b" font-size="%g" text-anchor="middle" x="%g" y="%g">%s</text>' % (lsize, b.cx, y, esc(l)))
            y += b.label_dy
        y += b.sub_gap - b.label_dy
        for s in b.sub_lines:
            parts.append('<text class="r" font-size="%g" text-anchor="middle" x="%g" y="%g">%s</text>' % (SUB_SIZE, b.cx, y, esc(s)))
            y += b.sub_dy
        parts.append("</g>")
        return "\n".join(parts)

    def _logo_svg(self):
        path = os.path.join(HERE, "..", "..", "specy-ai-logo.svg")
        inner = re.search(r"<svg[^>]*>(.*)</svg>", open(path, encoding="utf-8").read(), re.S).group(1).strip()
        y = self.H - 120
        return ('<a href="https://specy.ai" xlink:href="https://specy.ai" target="_blank" rel="noopener"><title>specy.ai</title>'
                '<g id="logo" transform="translate(40,%d) scale(1.1325,1.1050)">%s</g></a>' % (y, inner))

    def _title_svg(self):
        ft = self.fonts["t"]
        tw = max(ft.width(l, TITLE_SIZE) for l in self.title_lines)
        w = max(1147, math.ceil(tw + 160))
        x = (self.W - w) / 2
        h = 159 if len(self.title_lines) > 1 else 120
        out = ['<rect x="%.1f" y="35.5" width="%d" height="%d" rx="27" fill="#fff" stroke="%s" stroke-width="3" filter="url(#sh)"/>' % (x, w, h, TITLE_INK)]
        ys = [101, 170] if len(self.title_lines) > 1 else [35.5 + h / 2 + 22]
        for l, y in zip(self.title_lines, ys):
            out.append('<text class="t" font-size="%g" text-anchor="middle" x="%g" y="%.1f">%s</text>' % (TITLE_SIZE, self.W / 2, y, esc(l)))
        return "\n".join(out)

    # -- checks
    def _check(self):
        bs = list(self.boxes.values())
        for i, a in enumerate(bs):
            if a.x < 30 or a.y < 220 or a.x1 > self.W - 30 or a.y1 > self.H - 30:
                print("WARN box %s outside the frame (%d,%d)-(%d,%d)" % (a.id, a.x, a.y, a.x1, a.y1))
            if a.x < 340 and a.y1 > self.H - 130:
                print("WARN box %s overlaps the logo area" % a.id)
            for b in bs[i + 1:]:
                if a.x < b.x1 and b.x < a.x1 and a.y < b.y1 and b.y < a.y1:
                    print("WARN boxes %s and %s overlap" % (a.id, b.id))
        for e in self.edges:
            for k in (e.src, e.dst):
                if k not in self.boxes:
                    sys.exit("edge references unknown box %s" % k)

    # -- output
    def render(self):
        self._measure()
        self._check()
        W, H = self.W, self.H
        edges = "\n".join(self._edge_svg(e) for e in self.edges)
        cards = "\n".join(self._card_svg(e) for e in self.edges)
        boxes = "\n".join(self._box_svg(b) for b in self.boxes.values())
        title, logo = self._title_svg(), self._logo_svg()
        faces = "".join(self.fonts[c].embedded_face() for c in ("b", "r", "t"))
        css = (faces +
               '.b{font-family:"IBM Plex Sans Condensed",sans-serif;font-weight:700;fill:%s}' % INK +
               '.r{font-family:"IBM Plex Sans Condensed",sans-serif;font-weight:400;fill:%s}' % INK +
               '.t{font-family:"EB Garamond",serif;font-weight:700;fill:%s}' % TITLE_INK +
               '.c{fill:none;stroke:%s;stroke-linecap:round;stroke-linejoin:round}' % RED)
        frame = ('<g fill="none" stroke="#1e2d3b" stroke-width="3" stroke-dasharray="11 8.634">'
                 '<line x1="11.5" y1="10.5" x2="%d" y2="10.5"/><line x1="%d" y1="10.5" x2="%d" y2="%d"/>'
                 '<line x1="11.5" y1="10.5" x2="11.5" y2="%d"/><line x1="11.5" y1="%d" x2="%d" y2="%d"/></g>'
                 % (W - 15, W - 15, W - 15, H - 15, H - 15, H - 15, W - 15, H - 15))
        return ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                'width="%d" height="%d" viewBox="0 0 %d %d">\n<title>%s</title>\n'
                '<defs><style>%s</style>\n'
                '<filter id="sh" x="-5%%" y="-15%%" width="112%%" height="132%%">'
                '<feDropShadow dx="6" dy="6" stdDeviation="3.5" flood-color="#000" flood-opacity="0.4"/></filter></defs>\n'
                '<rect width="%d" height="%d" fill="%s"/>\n%s\n%s\n<g class="edges">\n%s\n</g>\n<g class="cards">\n%s\n</g>\n'
                '<g class="nodes">\n%s\n</g>\n%s\n</svg>\n'
                % (W, H, W, H, esc(self.svg_title), css, W, H, BG, frame, title, edges, cards, boxes, logo))

    def write(self, path):
        svg = self.render()
        open(path, "w", encoding="utf-8").write(svg)
        print("wrote %s (%d nodes, %d edges, %d bytes)" % (path, len(self.boxes), len(self.edges), len(svg)))
