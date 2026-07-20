import { Component, Input, OnDestroy, signal } from '@angular/core';

/**
 * Smoothly animates (count-up / count-down) a numeric KPI when its value changes.
 * Uses requestAnimationFrame and writes to a signal, so it re-renders correctly in
 * the zoneless change-detection model. Disposes its animation frame on destroy.
 */
@Component({
  selector: 'app-metric',
  standalone: true,
  template: `{{ display() }}`
})
export class MetricValueComponent implements OnDestroy {
  display = signal('0');

  private current = 0;
  private raf = 0;
  private _decimals = 0;

  @Input() set decimals(v: number) { this._decimals = v; this.display.set(this.fmt(this.current)); }

  @Input() set value(v: number | null | undefined) { this.animateTo(Number(v ?? 0)); }

  private animateTo(target: number): void {
    cancelAnimationFrame(this.raf);
    const start = this.current;
    if (start === target) { this.display.set(this.fmt(target)); return; }

    const t0 = performance.now();
    const duration = 450;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);          // ease-out cubic
      this.current = start + (target - start) * eased;
      this.display.set(this.fmt(this.current));
      if (k < 1) { this.raf = requestAnimationFrame(tick); }
      else { this.current = target; this.display.set(this.fmt(target)); }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private fmt(v: number): string {
    const f = Math.pow(10, this._decimals);
    return (Math.round(v * f) / f).toFixed(this._decimals);
  }

  ngOnDestroy(): void { cancelAnimationFrame(this.raf); }
}
