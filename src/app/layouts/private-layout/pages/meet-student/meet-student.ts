import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProgramaAyoService } from '../../../../core/services/programa-ayo.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';
import { StorageServices } from '../../../../core/services/storage.services';
import { ProgramaAyo } from '../../../../core/models/Course';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-meet-student',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meet-student.html',
  styleUrl: './meet-student.css'
})
export class MeetStudent implements OnInit {

  assetsUrl = environment.assets;
  programas: ProgramaAyo[] = [];
  isLoading = false;
  accountsReceivable: any[] = [];

  constructor(
    private programaAyoService: ProgramaAyoService,
    private accountReceivableService: AccountReceivableService,
    private router: Router
  ) { }

  ngOnInit(): void {
    console.log(this.accountsReceivable);
    this.loadAccountsReceivable();
    this.programas = [
      {
        id: '1',
        curso_id: '1',
        fecha_finalizacion: '2024-12-31',
        precio_curso: 1500,
        moneda: '$',
        programa_con_inscripcion: true,
        precio_inscripcion: 500,
        id_nivel: {
          id: '1',
          tematica: 'Inglés Avanzado',
          nivel: 'B2',
          subcategoria: 'Business',
          imagen: 'assets/icons/ayo.png',
          categoria: 'Idiomas',
          idioma: 'Inglés'
        }
      }
    ];
  }

  goBack(): void {
    this.router.navigate(['/private/dashboard']);
  }

  loadAccountsReceivable(): void {
    const user = StorageServices.getCurrentUser();

    if (user && user.tipo_documento && user.numero_documento) {
      this.accountReceivableService.getAccountsByDocument(user.tipo_documento, user.numero_documento).subscribe({
        next: (response) => {
          this.accountsReceivable = response.data;
          console.log('Cuentas por cobrar cargadas en Meetings:', this.accountsReceivable);
        },
        error: (error) => {
          console.error('Error al cargar cuentas por cobrar:', error);
        }
      });
    } else {
      console.warn('Información de documento del usuario no encontrada. Por favor inicie sesión nuevamente.');
    }
  }
}
