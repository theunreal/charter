import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map} from 'rxjs/operators';
import {environment} from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DataProviderService {

  private stockAPIConfig = {
    symbol: 'MSFT',
    interval: '5min',
    apikey: 'demo'
  };

  private populationAPIConfig = {
    country: 'Brazil',
    age: 18,
    dataField: 'total',
    labelField: 'year',
  };

  constructor(private http: HttpClient) { }

  getStockData(): Promise<any> {
    const apiURL = this.generateStockAPIURL();
    const stockResultKey = 'Time Series (5min)';
    const dataField = '4. close';

    return this.http.get(apiURL)
      .pipe(
        map((result) => {
          const labels = Object.keys(result[stockResultKey]);
          const data = labels.map((timestamp) => result[stockResultKey][timestamp][dataField]);
          return { labels, data };
      }))
      .toPromise()
      .catch((err) => console.error('Stocks API', `Server Error: ${err}`));
  }

  getPopulationData(): Promise<any> {
    const labels = [];
    const data = [];

    return this.http.get(`${environment.APIS.POPULATION}/${this.populationAPIConfig.country}/${this.populationAPIConfig.age}/`)
      .pipe(
        map((result: any) => {
          result.forEach((item) => {
            labels.push(item[this.populationAPIConfig.labelField]);
            data.push(item[this.populationAPIConfig.dataField]);
          });
          return { labels, data };
        }))
      .toPromise()
      .catch((err) => {
        console.error('Population API Server Error', err);
        return null;
      });
  }

  get populationCountry() {
    return this.populationAPIConfig.country;
  }

  private generateStockAPIURL(): string {
    let apiURL = environment.APIS.STOCK;
    for (const key in this.stockAPIConfig) {
      if (this.stockAPIConfig[key]) {
        apiURL += `&${key}=${this.stockAPIConfig[key]}`;
      }
    }
    return apiURL;
  }
}
