import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { StorageServices } from '../../../../../core/services/storage.services';
import { ProgramaAyo } from '../../../../../core/models/Course';
import { environment } from '../../../../../../environments/environment';
import { NotificationService } from '../../../../../core/services/notification.service';

declare var gapi: any;
declare var google: any;

@Component({
  selector: 'app-meet-student',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
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
    private router: Router,
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

    if (user && user.id) {
       this.programaAyoService.getProgramaAyo(undefined, undefined, user.id).subscribe({
         next: (response) => {
           const allPrograms = response.data || [];
           const userPrograms = allPrograms.filter(program => {
             if (program.id_nivel && program.id_nivel.estudiantes_id && Array.isArray(program.id_nivel.estudiantes_id)) {
               const isStudent = program.id_nivel.estudiantes_id.some((student: any) => student.id === user.id);
               return isStudent;
             }
             return false;
           });

          this.accountsReceivable = userPrograms.map(program => ({
            id: program.id,
            programa_ayo_id: program,
          }));

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

   handleTestAndJoin(event: Event, reunion: any): void {
     event.preventDefault();
     if (reunion.link_reunion) {
         window.open(reunion.link_reunion, '_blank');
     }
   }

}
