import {AfterViewInit, Component, OnDestroy} from '@angular/core';
import {DataProviderService} from './data-provider.service';
import {Chart} from 'chart.js';
import {FormControl, FormGroup} from '@angular/forms';
import {debounceTime, filter, takeUntil} from 'rxjs/operators';
import {MatSnackBar} from '@angular/material';
import {Subject} from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit, OnDestroy {

  supportedChartTypes: ChartType[] = ['stockChart', 'populationChart'];
  error: any;

  filterFormGroup: FormGroup = new FormGroup({
    threshold: new FormControl({value: 108.5, disabled: this.error}), // Default threshold value
    numDataPoints: new FormControl({value: 20, disabled: this.error}), // Default number of chart points
    currentChartType: new FormControl(this.supportedChartTypes[0]) // Default chart type
  });

  chartElement: Chart = null;
  CHARTS = {
    stockChart: null,
    populationChart: null
  };

  thresholdExceededColor = 'red';
  naturalThresholdColor = 'green';
  thresholdSetIndex = 1;
  thresholdInputStep;

  loaded = false;

  private unsubscribe$ = new Subject();

  constructor(private dataProviderService: DataProviderService, private snackBar: MatSnackBar) {
  }

  ngAfterViewInit(): void {
    this.updateChart()
      .then(() => {
        this.filterFormGroup.controls.threshold.valueChanges
          .pipe(
            debounceTime(300), // So we don't re-render the chart every character change
            filter(() => !this.error), // Ignore any value changes in error state
            takeUntil(this.unsubscribe$)
          )
          .subscribe((threshold) => {
            const datasets = this.chartElement.data.datasets;
            const currentChartType = this.filterFormGroup.controls.currentChartType.value;
            datasets[this.thresholdSetIndex].data = Array(datasets[this.thresholdSetIndex].data.length)
              .fill(threshold);
            datasets[0].pointBackgroundColor = this.CHARTS[currentChartType].data
              .map((value) => value > this.filterFormGroup.controls.threshold.value ?
                this.thresholdExceededColor :
                this.naturalThresholdColor);
            this.chartElement.update();
          });
      });

    this.filterFormGroup.controls.numDataPoints.valueChanges
      .pipe(
        debounceTime(300), // So we don't re-render the chart every character change
        filter((numDataPoints) => numDataPoints >= 1 && !this.error), // Ignore any value lower than 1
        takeUntil(this.unsubscribe$)
      )
      .subscribe((dataPoints) => {
        const currentChart = this.filterFormGroup.controls.currentChartType.value;

        // Can also be optimized to be changed without re-rendering the chart DOM
        this.buildChart(
          this.CHARTS[currentChart].labels,
          this.CHARTS[currentChart].data,
          dataPoints
        );
      });
  }

  /**
   *  Retrieve chart data from the server then builds the chart.
   *  Only one API request for each provider - once we have the data, use it.
   */
  async updateChart(): Promise<void> {
    const chartType = this.filterFormGroup.controls.currentChartType.value;

    switch (chartType) {
      case 'stockChart':
        if (!this.CHARTS.stockChart) { // Simple caching for api data until the user exit the page
          this.CHARTS.stockChart = await this.dataProviderService.getStockData();
        }
        this.thresholdInputStep = 0.1;
        break;
      case 'populationChart':
        if (!this.CHARTS.populationChart) { // Simple caching for api data until the user exit the page
          this.CHARTS.populationChart = await this.dataProviderService.getPopulationData();
        }
        this.thresholdInputStep = 10e3;
        break;
      default:
        console.warn(`Unsupported chart type: ${chartType}`);
        break;
    }

      if (!this.CHARTS[chartType]) {
        this.loaded = true;
        this.error = 'Unable to parse data from the server. Please check the server.';
        this.filterFormGroup.controls.threshold.disable();
        this.filterFormGroup.controls.numDataPoints.disable();
        this.snackBar.open(`Error parsing ${this.filterFormGroup.controls.currentChartType.value} data`,
          null,
          { duration: 2500});
        return;
      }

      this.buildChart();

    this.loaded = true;
  }

  chartTypeChange(): void {
    this.init();
    // Add it to the event queue (a tick is needed for the DOM) and update the chart
    setTimeout(() => this.updateChartType());
  }

  updateChartType(): void {
    this.updateChart();
  }

  /**
   * Builds the chart. Accept current chart type as default. Allow passing custom chart data as well.
   * NOTE: `map` should be optimized for larger datasets.
   * @param labels - chart X axis
   * @param data - chart Y axis
   * @param maxDataPoints - maximum count of points to show
   */
  buildChart(labels: string[] = this.CHARTS[this.filterFormGroup.controls.currentChartType.value].labels,
             data: number[] = this.CHARTS[this.filterFormGroup.controls.currentChartType.value].data,
             maxDataPoints: number = this.filterFormGroup.controls.numDataPoints.value): void {

    if (labels.length > maxDataPoints) {
      labels = labels.slice(0, maxDataPoints);
      data = data.slice(0, maxDataPoints);
    }

    const label = this.getDatasetLabel();

    // Mark points that exceeds the threshold
    const pointBackgroundColor = data
      .map((value) => value > this.filterFormGroup.controls.threshold.value ?
        this.thresholdExceededColor :
        this.naturalThresholdColor);

    // Just update the chart if the chart element already exists
    if (this.chartElement) {
      this.chartElement.data.labels = labels;
      // Update the object without overwriting current fields
      this.chartElement.data.datasets[0] = { ...this.chartElement.data.datasets[0], data, label, pointBackgroundColor };
      this.chartElement.data.datasets[1].data = data.map(() => this.filterFormGroup.controls.threshold.value);
      this.chartElement.update();
      return;
    }

    // Create a new chart
    this.chartElement = new Chart('canvas', {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label,
              data,
              borderColor: '#3F51B5',
              backgroundColor: '#ffffff',
              fill: false,
              pointBackgroundColor
            }, {
              label: 'Threshold',
              data: data.map(() => this.filterFormGroup.controls.threshold.value),
              borderDash: [7, 3],
              borderColor: '#878787',
              backgroundColor: '#ffffff',
              fill: false,
              pointRadius: 0,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          legend: {
            display: true
          }
        }
      });

    }

    ngOnDestroy(): void {
      this.unsubscribe$.next();
      this.unsubscribe$.complete();
    }

    private init() {
      this.loaded = false;
      if (this.error) {
        this.error = false;
        this.filterFormGroup.controls.threshold.enable();
        this.filterFormGroup.controls.numDataPoints.enable();
      }
    }

    private getDatasetLabel() {
      return this.filterFormGroup.controls.currentChartType.value === 'stockChart' ?
        'Close Price' :
        `Total Population (${this.dataProviderService.populationCountry})`;
    }
}

type ChartType = 'stockChart' | 'populationChart';
interface Charter {
  labels: string[];
  data: number[];
}
