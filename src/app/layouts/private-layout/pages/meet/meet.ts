import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {StorageServices} from '../../../../core/services/storage.services';
import { MeetStudent } from './meet-students/meet-student';
import {TeacherMeetingsComponent} from './meet-teacher/meet-teacher';
import {Roles} from '../../../../core/const/Roles';

@Component({
  selector: 'app-meet-component',
  standalone: true,
  imports: [CommonModule, MeetStudent, TeacherMeetingsComponent],
  templateUrl: './meet.html',
  styleUrl: './meet.css'
})
export class MeetComponent implements OnInit {

  showStudent = false;
  showTeacher = false;

  constructor() { }

  ngOnInit(): void {
    const currentUser = StorageServices.getCurrentUser();
    const role = currentUser?.role;

    if (role === Roles.STUDENT) {
      this.showStudent = true;
    } else if (role === Roles.TEACHER) {
      this.showTeacher = true;
    }
  }

}
