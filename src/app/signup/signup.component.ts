import { Component, OnDestroy, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SessionService } from '../session.service';
import { INDIA_LOCATIONS } from './india-locations';

type FieldName = 'photo' | 'name' | 'phone' | 'password' | 'state' | 'district' | 'postalCode';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})
export class SignupComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly session = inject(SessionService);

  readonly states = Object.keys(INDIA_LOCATIONS);
  districts: string[] = [];
  showPassword = false;
  submitted = false;
  photoPreview: string | null = null;
  photoError = '';

  private readonly allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly maxPhotoBytes = 2 * 1024 * 1024; // 2 MB

  readonly form = this.fb.nonNullable.group({
    photo: [null as File | null, Validators.required],
    name: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    state: ['', Validators.required],
    district: [{ value: '', disabled: true }, Validators.required],
    postalCode: ['', [Validators.required, Validators.pattern(/^[1-9]\d{5}$/)]],
  });

  onStateChange(): void {
    const state = this.form.controls.state.value;
    this.districts = INDIA_LOCATIONS[state] ?? [];
    const district = this.form.controls.district;
    district.reset('');
    if (this.districts.length) {
      district.enable();
    } else {
      district.disable();
    }
  }

  invalid(field: FieldName): boolean {
    const c = this.form.controls[field];
    return c.invalid && (c.touched || c.dirty);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    // Clear the input so choosing or capturing the same photo again still fires a change event.
    input.value = '';

    if (!this.allowedPhotoTypes.includes(file.type)) {
      this.rejectPhoto('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > this.maxPhotoBytes) {
      this.rejectPhoto('The photo must be 2 MB or smaller.');
      return;
    }

    this.photoError = '';
    this.setPreview(URL.createObjectURL(file));
    this.form.controls.photo.setValue(file);
    this.form.controls.photo.markAsDirty();
  }

  removePhoto(): void {
    this.photoError = '';
    this.setPreview(null);
    this.form.controls.photo.setValue(null);
    this.form.controls.photo.markAsTouched();
  }

  ngOnDestroy(): void {
    this.setPreview(null);
  }

  private rejectPhoto(message: string): void {
    this.photoError = message;
    this.setPreview(null);
    this.form.controls.photo.setValue(null);
    this.form.controls.photo.markAsTouched();
  }

  private setPreview(url: string | null): void {
    if (this.photoPreview) {
      URL.revokeObjectURL(this.photoPreview);
    }
    this.photoPreview = url;
  }

  async onSubmit(): Promise<void> {
    this.submitted = false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // DEMO: remember the registration (with a small copy of the photo) in this browser so
    // sign in, the coupon page and the admin Carpenters list can use it.
    // TODO: send the form to your backend over HTTPS. Because of the photo, use
    // FormData (append each field plus the photo File) instead of plain JSON.
    // Never log or store the plain password.
    const { name, phone, photo, state, district, postalCode } = this.form.getRawValue();
    const photoUrl = photo ? await this.toAvatarDataUrl(photo) : null;
    this.session.saveRegistration({
      name,
      phone,
      photoUrl,
      state,
      district,
      postalCode,
      registeredAt: new Date().toISOString(),
    });
    this.submitted = true;
  }

  /** Crops the photo to a centred square and shrinks it to 256px for the profile picture. */
  private async toAvatarDataUrl(file: File): Promise<string | null> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
