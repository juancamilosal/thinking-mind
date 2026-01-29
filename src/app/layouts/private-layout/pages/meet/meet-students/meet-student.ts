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

  // Google Calendar Integration
  private CLIENT_ID = '879608095413-95f61hvhukdqfba7app9fhmd5g32qho8.apps.googleusercontent.com';
  private DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  tokenClient: any;
  gapiInited = false;
  gisInited = false;

  constructor(
    private programaAyoService: ProgramaAyoService,
    private router: Router,
    private notificationService: NotificationService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.loadAccountsReceivable();
    this.loadGoogleScripts();
  }

  goBack(): void {
    this.router.navigate(['/private/dashboard']);
  }

  loadAccountsReceivable(): void {
    this.isLoading = true;
    const user = StorageServices.getCurrentUser();

    if (user && user.id) {
      this.programaAyoService.getProgramaAyo().subscribe({
        next: (response) => {
          const allPrograms = response.data || [];

          // Filter programs where the user is in the students list of the level
          const userPrograms = allPrograms.filter(program => {
            if (program.id_nivel && program.id_nivel.estudiantes_id && Array.isArray(program.id_nivel.estudiantes_id)) {
              return program.id_nivel.estudiantes_id.some((student: any) => student.id === user.id);
            }
            return false;
          });

          // Map to the structure expected by the view (wrapping in an object mimicking account)
          this.accountsReceivable = userPrograms.map(program => ({
            id: program.id, // Use program ID as account ID substitute
            programa_ayo_id: program,
            // Add other fields if necessary, but view mainly uses programa_ayo_id
          }));

          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading programs:', error);
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

  // Google Calendar Integration Helpers
  loadGoogleScripts() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => this.gapiLoaded();
    document.body.appendChild(script);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = () => this.gisLoaded();
    document.body.appendChild(gisScript);
  }

  gapiLoaded() {
    gapi.load('client', async () => {
      await gapi.client.init({
        discoveryDocs: [this.DISCOVERY_DOC],
      });
      this.gapiInited = true;
    });
  }

  gisLoaded() {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPES,
      callback: '', // defined later
    });
    this.gisInited = true;
  }

  ensureCalendarToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
          console.error('Token Error:', resp);
          reject(resp);
        } else {
          // Update gapi client with new token
          if (gapi.client) {
            gapi.client.setToken(resp);
          }
          console.log('Token Received (Safe):', resp.access_token ? 'YES (Length: ' + resp.access_token.length + ')' : 'NO');
          resolve(resp.access_token);
        }
      };

      // Always request a fresh token to avoid 401 from stale/mismatched credentials
      // Using 'consent' forces the popup to ensure we get a valid token for THIS Client ID
      console.log('Requesting fresh access token (prompt: consent)...');
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  async addParticipantsToMeetingBatch(reunion: any, emailsToAdd: string[]): Promise<void> {
    console.log('--> addParticipantsToMeetingBatch START', reunion.id_reunion, emailsToAdd);

    if (!reunion.id_reunion) {
        this.notificationService.showError('Error', 'Reunión sin ID');
        return;
    }

    try {
        console.log('1. Getting Token...');
        const token = await this.ensureCalendarToken();
        console.log('Token received (len):', token ? token.length : 0);

        if (!token) {
            throw new Error('No se obtuvo un token válido.');
        }

        // Explicitly construct headers as requested
        let headers = new HttpHeaders();
        headers = headers.set('Authorization', `Bearer ${token}`);
        headers = headers.set('Content-Type', 'application/json');

        const baseUrl = `https://content.googleapis.com/calendar/v3/calendars/primary/events/${reunion.id_reunion}?alt=json`;

        // 1. Get existing event
        console.log('2. GET event details...');
        const event: any = await lastValueFrom(this.http.get(baseUrl, { headers }));
        console.log('Event details received:', event);

        const existingAttendees = event.attendees || [];

        // 2. Simple merge: existing + new
        const newAttendees = emailsToAdd
            .filter(email => !existingAttendees.some((a: any) => a.email === email))
            .map(email => ({ email }));

        const finalAttendees = [...existingAttendees, ...newAttendees];
        console.log(`Merging attendees: ${existingAttendees.length} existing + ${newAttendees.length} new = ${finalAttendees.length} total`);

        // 3. PATCH
        const patchUrl = `${baseUrl}&sendUpdates=all`;
        console.log('3. PATCHing event...');

        await lastValueFrom(this.http.patch(patchUrl, {
            attendees: finalAttendees
        }, { headers }));

        console.log('--> PATCH success');
        this.notificationService.showSuccess('Éxito', `Reunión ${reunion.id_reunion}: Agregados ${newAttendees.length} participantes.`);

    } catch (error: any) {
        console.error('--> Error in addParticipantsToMeetingBatch:', error);
        const msg = error?.error?.error?.message || error.message || 'Error desconocido';
        this.notificationService.showError('Error API Google', msg);
    }
  }

   handleTestAndJoin(event: Event, reunion: any): void {
     event.preventDefault();
     if (reunion.link_reunion) {
         window.open(reunion.link_reunion, '_blank');
     }
   }

   async runManualTest(account: any): Promise<void> {
    console.log('=== RUNNING MANUAL TEST (SPECIFIC EMAILS) ===');

    // 1. Hardcoded emails as requested
    const emails = ['juancamilsalazarrojas@gmail.com', 'martin@gmail.com'];
    console.log('Target Emails:', emails);

    // 2. Try to find meetings loosely, or use a hardcoded test ID
    let meetings: any[] = [];

    if (account?.programa_ayo_id?.id_reuniones_meet) {
        meetings = account.programa_ayo_id.id_reuniones_meet;
    } else {
        console.warn('Structure not found. Using HARDCODED test meeting ID.');
        meetings = [{ id_reunion: 't1gbfhg098u82gr79kashf95sg' }]; // Fallback ID from previous context
    }

    console.log(`Processing ${meetings.length} meetings...`);

    // 3. Just Run It
    for (const reunion of meetings) {
        if (reunion.id_reunion) {
             await this.addParticipantsToMeetingBatch(reunion, emails);
        } else {
            console.log('Skipping object without id_reunion:', reunion);
        }
    }

    console.log('=== TEST FINISHED ===');
  }
}
