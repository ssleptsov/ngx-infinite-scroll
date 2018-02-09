import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/sampleTime';

import { ElementRef } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operator/map';
import { of } from 'rxjs/observable/of';

import * as Models from '../models';
import { AxisResolver } from './axis-resolver';
import { shouldTriggerEvents, IScrollConfig } from './event-trigger';
import { resolveContainerElement } from './ngx-ins-utils';
import { calculatePoints, createResolver } from './position-resolver';
import * as ScrollResolver from './scroll-resolver';

export function createScroller(config: Models.IScroller) {
  const { scrollContainer, scrollWindow, element, fromRoot } = config;
  const resolver = createResolver({
    axis: new AxisResolver(!config.horizontal),
    windowElement: resolveContainerElement(scrollContainer, scrollWindow, element, fromRoot)
  });
  const { totalToScroll: startWithTotal } = calculatePoints(element, resolver);
  const scrollState: Models.IScrollState = {
    lastScrollPosition: 0,
    lastTotalToScroll: 0,
    totalToScroll: startWithTotal,
    triggered: {
      down: 0,
      up: 0
    }
  };
  const options: Models.IScrollRegisterConfig = {
    container: resolver.container,
    throttle: config.throttle
  };
  const distance = {
    up: config.upDistance,
    down: config.downDistance
  };
  return attachScrollEvent(options)
    .mergeMap((ev: any) => of(calculatePoints(element, resolver)))
    .map((positionStats: Models.IPositionStats) =>
      toInfiniteScrollParams(scrollState.lastScrollPosition, positionStats, distance))
    .do(({ stats, scrollDown }: Models.IScrollParams) =>
      ScrollResolver.updateScrollState(
        scrollState,
        stats.scrolled,
        stats.totalToScroll,
      ))
    .filter(({ fire, scrollDown, stats: { totalToScroll } }: Models.IScrollParams) =>
      shouldTriggerEvents(
        fire, config.alwaysCallback, ScrollResolver.isTriggeredScroll(totalToScroll, scrollState, scrollDown))
    )
    .do(({ scrollDown, stats: { totalToScroll } }: Models.IScrollParams) => {
      ScrollResolver.updateTriggeredFlag(totalToScroll, scrollState, true, scrollDown);
    })
    .map(toInfiniteScrollAction);
}

export function attachScrollEvent(options: Models.IScrollRegisterConfig): Observable<{}> {
  return Observable
    .fromEvent(options.container, 'scroll')
    .throttle(options.throttle);
}

export function toInfiniteScrollParams(
  lastScrollPosition: number,
  stats: Models.IPositionStats,
  distance: Models.IScrollerDistance
): Models.IScrollParams {
  const { scrollDown, fire } = ScrollResolver.getScrollStats(
    lastScrollPosition,
    stats,
    distance
  );
  return {
    scrollDown,
    fire,
    stats
  };
}

export const InfiniteScrollActions = {
  DOWN: '[NGX_ISE] DOWN',
  UP: '[NGX_ISE] UP'
};

export function toInfiniteScrollAction(response: Models.IScrollParams): Models.IInfiniteScrollAction {
  const { scrollDown, stats: { scrolled: currentScrollPosition } } = response;
  return {
    type: scrollDown ? InfiniteScrollActions.DOWN : InfiniteScrollActions.UP,
    payload: {
      currentScrollPosition
    }
  };
}
