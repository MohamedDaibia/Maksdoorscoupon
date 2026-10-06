import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { INDIA_LOCATIONS } from './india-locations';

type FieldName = 'name' | 'phone' | 'password' | 'state' | 'district' | 'postalCode';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);

  readonly states = Object.keys(INDIA_LOCATIONS);
  districts: string[] = [];
  showPassword = false;
  submitted = false;

  readonly form = this.fb.nonNullable.group({
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

  onSubmit(): void {
    this.submitted = false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // TODO: send this.form.getRawValue() to your backend API over HTTPS.
    // Never log or store the plain password.
    this.submitted = true;
  }
}
