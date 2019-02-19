import { NgModule } from '@angular/core';
import {
  MatCardModule,
  MatInputModule,
  MatProgressBarModule,
  MatSelectModule,
  MatSidenavModule,
  MatSnackBarModule,
  MatToolbarModule
} from '@angular/material';

@NgModule({
  declarations: [],
  exports: [
    MatToolbarModule,
    MatCardModule,
    MatSelectModule,
    MatSidenavModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressBarModule
  ]
})
export class MaterialModule { }
