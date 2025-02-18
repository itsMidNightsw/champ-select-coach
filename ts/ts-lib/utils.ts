import { Timer } from "./timer";
import * as $ from "jquery"; //npm install --save-dev @types/jquery


export class Utils {

  public static arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  public static arraysEqualSkipLeftNulls(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i] && a[i] != null) return false;
    }
    return true;
  }

  public static flattenArray(arr: any[]) {
    return arr.reduce(function (flat, toFlatten) {
      return flat.concat(Array.isArray(toFlatten) ? Utils.flattenArray(toFlatten) : toFlatten);
    }, []);
  }

  public static sum(arr: number[]) {
    return arr.reduce((a, b) => a + b, 0);
  }

  public static avg(arr: number[]) {
    return this.sum(arr) / arr.length;
  }

  public static max(arr: number[]) {
    return arr.reduce((a, b) => Math.max(a,b), arr[0]);
  }

  public static groupByCount(xs) {
    return xs.reduce(function(rv, x) {
      rv[x] = (rv[x] || 0) + 1;
      return rv;
    }, {});
  }

  public static groupByLambda(xs, func) {
    return xs.reduce(function(rv, x) {
      (rv[func(x)] = rv[func(x)] || []).push(x);
      return rv;
    }, {});
  }

  public static setsAreEqual(as, bs) {
    if (as.size !== bs.size) return false;
    for (var a of as) if (!bs.has(a)) return false;
    return true;
  }

  public static setIncludes(as, bs) {
    for (var b of bs) if (!as.has(b)) return false;
    return true;
  }

  public static mergeDicts(a: object, b: object) {
    const c = {};
    for (let k in a) {
      c[k] = a[k];
    }
    for (let k in b) {
      c[k] = b[k];
    }
    return c;
  }

  public static capitalizeFirstLetter(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  public static probabilityToScore(x: number) {
    return (Math.round(x * 100) / 10).toFixed(1).toString();
  }

  public static async smoothChangeNumber(elem: HTMLElement, targetN: number, ms: number = 500) {
    const fromN = parseFloat(elem.innerHTML) || 0;
    const myI = ($(elem).data('i') || 0) + 1;
    $(elem).data('i', myI);
    for (let t = 0; true; t += 60) {
      t = Math.min(t, ms);
      let currN = fromN + (targetN - fromN) * (0.5 - 0.5 * Math.cos(t / ms * Math.PI));
      elem.innerHTML = (Math.round(currN * 10) / 10).toFixed(1); // Digits to show after comma, forces .0 if such
      const w = Math.min(30, ms - t);
      if (w > 0) await Timer.wait(w);
      if (t == ms || $(elem).data('i') != myI) break;
    }
  }

  public static async stopSmoothChangeNumberAnimation(elem: HTMLElement) {
    const myI = ($(elem).data('i') || 0) + 1;
    $(elem).data('i', myI);
  }

  public static setCallbacksForEditButton(element: any, isActive: any, onClick: any) {
    $(element).parent().on('mouseenter', async () => { if (await isActive()) {$(element).show(); $(element).css('opacity', '100%') } else { $(element).hide(); }});
    $(element).parent().on('mouseleave', async () => { if (await isActive()) {$(element).show(); $(element).css('opacity', '30%') } else { $(element).hide(); }});
    $(element).parent().trigger('mouseleave');
    $(element).on('click', async () => { if (await isActive()) await onClick() });

  }

}