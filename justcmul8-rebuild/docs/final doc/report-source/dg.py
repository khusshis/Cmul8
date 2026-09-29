"""Black-and-white diagram toolkit for the JustCmul8 report (matplotlib)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, Ellipse, Polygon, Circle, FancyArrowPatch
plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["hatch.linewidth"] = 0.8

OUT = "img/"
GREY = "#CFE3F8"
LGREY = "#E9F4E9"


def canvas(w, h, xlim, ylim):
    fig = plt.figure(figsize=(w, h))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(*xlim); ax.set_ylim(*ylim); ax.axis("off")
    return fig, ax


def save(fig, name):
    fig.savefig(OUT + name + ".png", dpi=220, facecolor="white")
    plt.close(fig)


def box(ax, x, y, w, h, text="", fs=9, fill="white", lw=1.2, rounded=False, bold=False, ls="-", ha="center", va="center", italic=False):
    if rounded:
        p = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=%s" % min(w, h) * 1 if False else "round,pad=0,rounding_size=0.12",
                           fc=fill, ec="black", lw=lw, ls=ls)
    else:
        p = Rectangle((x, y), w, h, fc=fill, ec="black", lw=lw, ls=ls)
    ax.add_patch(p)
    if text:
        tx = x + w / 2 if ha == "center" else x + 0.1
        ax.text(tx, y + h / 2, text, ha=ha, va=va, fontsize=fs, fontweight="bold" if bold else "normal",
                fontstyle="italic" if italic else "normal", linespacing=1.25)
    return (x, y, w, h)


def ell(ax, cx, cy, w, h, text="", fs=9, fill="white", lw=1.2, bold=False):
    ax.add_patch(Ellipse((cx, cy), w, h, fc=fill, ec="black", lw=lw))
    if text:
        ax.text(cx, cy, text, ha="center", va="center", fontsize=fs, fontweight="bold" if bold else "normal", linespacing=1.2)


def dia(ax, cx, cy, w, h, text="", fs=8.5, fill="white", lw=1.2):
    ax.add_patch(Polygon([(cx - w / 2, cy), (cx, cy + h / 2), (cx + w / 2, cy), (cx, cy - h / 2)], fc=fill, ec="black", lw=lw))
    if text:
        ax.text(cx, cy, text, ha="center", va="center", fontsize=fs, linespacing=1.15)


def dot(ax, cx, cy, r=0.13, filled=True, ring=False):
    ax.add_patch(Circle((cx, cy), r, fc="black" if filled else "white", ec="black", lw=1.3))
    if ring:
        ax.add_patch(Circle((cx, cy), r * 1.6, fc="none", ec="black", lw=1.3))


def bar(ax, x, y, w, h=0.09):
    ax.add_patch(Rectangle((x, y), w, h, fc="black", ec="black"))


def arr(ax, p1, p2, text="", fs=8, style="->", lw=1.1, ls="-", rad=0.0, off=(0, 0.1), tha="center", both=False, mut=11):
    st = "<->" if both else style
    a = FancyArrowPatch(p1, p2, arrowstyle=st, mutation_scale=mut, lw=lw, ls=ls, color="black",
                        connectionstyle="arc3,rad=%s" % rad, shrinkA=0, shrinkB=0)
    ax.add_patch(a)
    if text:
        mx, my = (p1[0] + p2[0]) / 2 + off[0], (p1[1] + p2[1]) / 2 + off[1]
        ax.text(mx, my, text, fontsize=fs, ha=tha, va="center", fontstyle="italic",
                bbox=dict(fc="white", ec="none", pad=0.6))


def txt(ax, x, y, s, fs=9, ha="center", va="center", bold=False, italic=False, rot=0):
    ax.text(x, y, s, fontsize=fs, ha=ha, va=va, fontweight="bold" if bold else "normal",
            fontstyle="italic" if italic else "normal", rotation=rot, linespacing=1.25)


def line(ax, pts, lw=1.1, ls="-"):
    xs, ys = zip(*pts)
    ax.plot(xs, ys, color="black", lw=lw, ls=ls, solid_capstyle="butt")
