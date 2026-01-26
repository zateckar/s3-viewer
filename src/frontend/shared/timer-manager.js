/**
 * Timer Manager - JavaScript version
 * Provides timer management functionality
 */

(function() {
    'use strict';

    // Timer Manager class
    class TimerManager {
        constructor() {
            this.timers = new Map();
        }

        setTimeout(callback, delay, context = null) {
            const id = setTimeout(() => {
                this.clearTimer(id);
                if (context) {
                    callback.call(context);
                } else {
                    callback();
                }
            }, delay);
            
            this.timers.set(id, { callback, delay, context });
            return id;
        }

        clearTimer(id) {
            clearTimeout(id);
            this.timers.delete(id);
        }

        clearAllTimers() {
            let count = 0;
            for (const id of this.timers.keys()) {
                clearTimeout(id);
                count++;
            }
            this.timers.clear();
            return count;
        }

        getActiveTimers() {
            return this.timers.size;
        }

        getTimerInfo(id) {
            return this.timers.get(id);
        }
    }

    // Browser Timer Manager class with additional features
    class BrowserTimerManager extends TimerManager {
        constructor() {
            super();
            this.intervals = new Map();
            this.rafCallbacks = new Map();
        }

        setInterval(callback, interval, context = null) {
            const id = setInterval(() => {
                if (context) {
                    callback.call(context);
                } else {
                    callback();
                }
            }, interval);
            
            this.intervals.set(id, { callback, interval, context });
            return id;
        }

        clearInterval(id) {
            clearInterval(id);
            this.intervals.delete(id);
        }

        requestAnimationFrame(callback, context = null) {
            const id = requestAnimationFrame(() => {
                this.rafCallbacks.delete(id);
                if (context) {
                    callback.call(context);
                } else {
                    callback();
                }
            });
            
            this.rafCallbacks.set(id, { callback, context });
            return id;
        }

        cancelAnimationFrame(id) {
            cancelAnimationFrame(id);
            this.rafCallbacks.delete(id);
        }

        clearAll() {
            const timerCount = this.clearAllTimers();
            
            for (const id of this.intervals.keys()) {
                clearInterval(id);
            }
            this.intervals.clear();
            
            for (const id of this.rafCallbacks.keys()) {
                cancelAnimationFrame(id);
            }
            this.rafCallbacks.clear();
            
            return timerCount + this.intervals.size + this.rafCallbacks.size;
        }

        getTotalActiveTimers() {
            return this.timers.size + this.intervals.size + this.rafCallbacks.size;
        }
    }

    // Component with Timers mixin
    class ComponentWithTimers {
        constructor() {
            this._timerManager = new BrowserTimerManager();
        }

        setTimeout(callback, delay) {
            return this._timerManager.setTimeout(callback, delay, this);
        }

        setInterval(callback, interval) {
            return this._timerManager.setInterval(callback, interval, this);
        }

        requestAnimationFrame(callback) {
            return this._timerManager.requestAnimationFrame(callback, this);
        }

        clearTimer(id) {
            this._timerManager.clearTimer(id);
        }

        clearInterval(id) {
            this._timerManager.clearInterval(id);
        }

        cancelAnimationFrame(id) {
            this._timerManager.cancelAnimationFrame(id);
        }

        destroy() {
            this._timerManager.clearAll();
        }
    }

    // Export classes and create default instance
    window.TimerManager = TimerManager;
    window.BrowserTimerManager = BrowserTimerManager;
    window.ComponentWithTimers = ComponentWithTimers;
    
    // Create a default global timer manager instance
    window.globalTimerManager = new BrowserTimerManager();

    console.log('✅ TimerManager loaded');
})();