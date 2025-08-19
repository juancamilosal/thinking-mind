import { Component } from '@angular/core';
import {CourseCardComponent} from '../../../../components/course-card/course-card';
import {COURSES} from '../../../../core/const/CoursesConst';
import {CourseInfoComponent} from '../../../../components/course-info/course-info';

@Component({
  selector: 'app-courses',
  imports: [
    CourseCardComponent, CourseInfoComponent
  ],
  templateUrl: './courses.html',
  standalone: true
})
export class Courses {

  protected readonly COURSES = COURSES;

  selectedCourse: any = null;
  showCourseInfo = false;

  openCourseInfo(course: any) {
    this.selectedCourse = course;
    this.showCourseInfo = true;
  }

  closeCourseInfo() {
    this.selectedCourse = null;
    this.showCourseInfo = false;
  }
}
