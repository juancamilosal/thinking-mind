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
    this.loadAccountsReceivable();
  }

  goBack(): void {
    this.router.navigate(['/private/dashboard']);
  }

  loadAccountsReceivable(): void {
    this.isLoading = true;
    const user = StorageServices.getCurrentUser();

    if (user && user.tipo_documento && user.numero_documento) {
      this.accountReceivableService.getAccountsByDocument(user.tipo_documento, user.numero_documento).subscribe({
        next: (response) => {
          this.accountsReceivable = response.data;
          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
        }
      });
    } else {
      this.isLoading = false;
    }
  }

  getProgramImage(account: any): string {
    const program = account.programa_ayo_id;
    if (program?.img) {
      const imgId = typeof program.img === 'object' ? program.img.id : program.img;
      return `${this.assetsUrl}/${imgId}`;
    }
    if (program?.id_nivel?.imagen) {
      return `${this.assetsUrl}/${program.id_nivel.imagen}`;
    }
    return 'assets/icons/ayo.png';
  }
}
