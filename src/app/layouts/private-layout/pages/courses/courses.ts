import { Component } from '@angular/core';
import {CourseCardComponent} from '../../../../components/course-card/course-card';
import {COURSES} from '../../../../core/const/CoursesConst';

@Component({
  selector: 'app-courses',
  imports: [
    CourseCardComponent
  ],
  templateUrl: './courses.html',
  standalone: true
})
export class Courses {

  protected readonly COURSES = COURSES;
}
