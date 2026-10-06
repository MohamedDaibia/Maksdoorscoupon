import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { HeaderComponent } from '../shared/header.component';
import { CouponResult, CouponService } from './coupon.service';

type Status = 'idle' | 'checking' | 'valid' | 'invalid' | 'claiming';

const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024; // refuse huge originals
const MAX_SIDE_PX = 1600; // photos are shrunk to this before upload

@Component({
  selector: 'app-coupon',
  imports: [ReactiveFormsModule, HeaderComponent],
  templateUrl: './coupon.component.html',
  styleUrl: './coupon.component.css',
})
export class CouponComponent {
  private readonly coupons = inject(CouponService);

  readonly code = new FormControl('', { nonNullable: true });

  readonly status = signal<Status>('idle');
  readonly reward = signal(0);
  readonly errorMessage = signal('');
  readonly claimedMessage = signal('');

  readonly doorPhoto = signal<File | null>(null);
  readonly doorPreview = signal<string | null>(null);
  readonly photoError = signal('');

  /** The door photo section appears once the coupon number is verified. */
  readonly showPhoto = computed(() => this.status() === 'valid' || this.status() === 'claiming');
  /** Claim needs a valid coupon and a door photo. */
  readonly canClaim = computed(() => this.status() === 'valid' && !!this.doorPhoto());

  constructor() {
    inject(DestroyRef).onDestroy(() => this.setPreview(null));

    this.code.valueChanges
      .pipe(
        map((v) => v.trim().toUpperCase()),
        tap(() => {
          this.status.set('idle');
          this.errorMessage.set('');
          this.claimedMessage.set('');
        }),
        debounceTime(450),
        distinctUntilChanged(),
        switchMap((value) => {
          if (!value) {
            return of<CouponResult | null>(null);
          }
          this.status.set('checking');
          return this.coupons.check(value);
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.applyCheck(result));
  }

  onClaim(): void {
    if (!this.canClaim()) {
      return;
    }
    this.status.set('claiming');
    this.coupons.claim(this.normalized(), this.doorPhoto()).subscribe((result) => {
      if (result.valid) {
        this.claimedMessage.set(`₹${result.reward} claimed successfully!`);
        this.code.reset('', { emitEvent: false });
        this.clearPhoto();
        this.status.set('idle');
        this.reward.set(0);
      } else {
        this.applyCheck(result);
      }
    });
  }

  async onDoorPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Clear the input so picking or capturing the same photo again still fires a change event.
    input.value = '';
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.photoError.set('Please choose an image file.');
      return;
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      this.photoError.set('That photo is too large. Please choose one under 15 MB.');
      return;
    }

    const resized = await this.shrink(file);
    if (!resized) {
      this.photoError.set('Could not read that photo. Please try another one.');
      return;
    }
    this.photoError.set('');
    this.doorPhoto.set(resized);
    this.setPreview(URL.createObjectURL(resized));
  }

  removeDoorPhoto(): void {
    this.photoError.set('');
    this.clearPhoto();
  }

  private clearPhoto(): void {
    this.doorPhoto.set(null);
    this.setPreview(null);
  }

  private setPreview(url: string | null): void {
    const old = this.doorPreview();
    if (old) {
      URL.revokeObjectURL(old);
    }
    this.doorPreview.set(url);
  }

  /** Shrinks the photo to at most 1600px on the longest side and saves it as a JPEG. */
  private async shrink(file: File): Promise<File | null> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const scale = Math.min(1, MAX_SIDE_PX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85),
      );
      return blob ? new File([blob], 'door-photo.jpg', { type: 'image/jpeg' }) : null;
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private normalized(): string {
    return this.code.value.trim().toUpperCase();
  }

  private applyCheck(result: CouponResult | null): void {
    if (!result) {
      this.status.set('idle');
    } else if (result.valid) {
      this.reward.set(result.reward);
      this.status.set('valid');
    } else {
      this.errorMessage.set(result.reason);
      this.status.set('invalid');
    }
  }
}
