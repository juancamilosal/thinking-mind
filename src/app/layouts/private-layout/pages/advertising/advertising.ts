import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdvertisingService } from '../../../../core/services/advertising.service';
import { AdvertisingItem } from '../../../../core/models/Advertising';
import { TranslateService } from '@ngx-translate/core';
import { AppButtonComponent } from '../../../../components/app-button/app-button.component';
import { FileService } from '../../../../core/services/file.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService } from '../../../../core/services/confirmation.service';

@Component({
  selector: 'app-advertising',
  standalone: true,
  imports: [CommonModule, TranslateModule, ReactiveFormsModule, AppButtonComponent],
  templateUrl: './advertising.html'
})
export class Advertising implements OnInit {
  items: AdvertisingItem[] = [];
  isLoading = false;
  showForm = false;
  editingItem: AdvertisingItem | null = null;
  form: FormGroup;
  previewImage: string | null = null;
  selectedFile: File | null = null;
  imageError: string | null = null;
  currentImageUrl: string | null = null;
  isSaving = false;

  constructor(
    private fb: FormBuilder,
    private service: AdvertisingService,
    private translate: TranslateService,
    private fileService: FileService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private confirmationService: ConfirmationService
  ) {
    this.form = this.fb.group({
      titulo: ['', Validators.required],
      enlace: ['', Validators.required],
      descripcion: ['', Validators.required],
      descripcion_ingles: ['', Validators.required],
      descripcion_frances: ['', Validators.required],
      activo: [true]
    });
  }

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.isLoading = true;
    this.service.list().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.items = res.data || [];
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  openNew(): void {
    this.editingItem = null;
    this.form.reset({
      titulo: '',
      enlace: '',
      descripcion: '',
      descripcion_ingles: '',
      descripcion_frances: '',
      activo: true
    });
    this.previewImage = null;
    this.selectedFile = null;
    this.imageError = null;
    this.currentImageUrl = null;
    this.showForm = true;
  }

  edit(item: AdvertisingItem): void {
    this.editingItem = item;
    this.form.patchValue({
      titulo: item.titulo || '',
      enlace: item.enlace || '',
      descripcion: item.descripcion || '',
      descripcion_ingles: item.descripcion_ingles || '',
      descripcion_frances: item.descripcion_frances || '',
      activo: !!item.activo
    });
    this.currentImageUrl = item.img_url || null;
    this.previewImage = null;
    this.selectedFile = null;
    this.imageError = null;
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
    this.editingItem = null;
    this.previewImage = null;
    this.selectedFile = null;
    this.imageError = null;
    this.currentImageUrl = null;
  }

  async submit(): Promise<void> {
    if (this.isSaving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.imageError = null;

    let imgId: any = this.editingItem?.img || null;

    if (!this.selectedFile && !imgId) {
      this.imageError = 'La imagen es obligatoria.';
      this.notificationService.showError('Error', 'La imagen es obligatoria.');
      this.isSaving = false;
      return;
    }

    if (this.selectedFile) {
      if (!this.selectedFile.type.startsWith('image/')) {
        this.imageError = 'Solo se permiten imágenes.';
        this.notificationService.showError('Error', 'Solo se permiten imágenes.');
        this.isSaving = false;
        return;
      }

      if (this.selectedFile.size > 5 * 1024 * 1024) {
        this.imageError = 'El archivo no debe superar los 5MB.';
        this.notificationService.showError('Error', 'El archivo no debe superar los 5MB.');
        this.isSaving = false;
        return;
      }

      try {
        const res = await firstValueFrom(this.fileService.uploadFile(this.selectedFile));
        const newId = res?.data?.id || imgId;

        if (this.editingItem?.img && this.editingItem.img !== newId) {
          this.fileService.deleteFile(this.editingItem.img).subscribe({
            error: () => {}
          });
        }

        imgId = newId;
      } catch {
        this.notificationService.showError('Error', 'No se pudo subir la imagen.');
        this.isSaving = false;
        return;
      }
    }

    const payload: AdvertisingItem = {
      ...this.form.value,
      img: imgId
    };

    const request$ = this.editingItem?.id
      ? this.service.update(this.editingItem.id, payload)
      : this.service.create(payload);

    request$.subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.showForm = false;
          this.editingItem = null;
          this.previewImage = null;
          this.selectedFile = null;
          this.imageError = null;
          this.currentImageUrl = null;
          this.isSaving = false;
          this.loadItems();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.notificationService.showError('Error', 'No se pudo guardar la publicidad.');
          this.isSaving = false;
        });
      }
    });
  }

  remove(item: AdvertisingItem): void {
    if (!item.id) return;
    const name = item.titulo || 'esta publicidad';
    this.confirmationService.showDeleteConfirmation(
      name,
      'publicidad',
      () => {
        this.service.delete(item.id as any).subscribe({
          next: () => {
            this.ngZone.run(() => {
              this.loadItems();
            });
          }
        });
      }
    );
  }

  getDescription(item: AdvertisingItem): string {
    const lang = (this.translate.currentLang || 'es').toLowerCase();
    if (lang.startsWith('en')) return item.descripcion_ingles || item.descripcion || '';
    if (lang.startsWith('fr')) return item.descripcion_frances || item.descripcion || '';
    return item.descripcion || '';
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.imageError = 'Solo se permiten imágenes.';
      this.notificationService.showError('Error', 'Solo se permiten imágenes.');
      this.selectedFile = null;
      this.previewImage = null;
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.imageError = 'El archivo no debe superar los 5MB.';
      this.notificationService.showError('Error', 'El archivo no debe superar los 5MB.');
      this.selectedFile = null;
      this.previewImage = null;
      return;
    }
    this.imageError = null;
    this.selectedFile = file;
    this.currentImageUrl = null;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewImage = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  toggleActivo(): void {
    const current = !!this.form.get('activo')?.value;
    this.form.get('activo')?.setValue(!current);
  }
}

