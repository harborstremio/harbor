use std::{sync::{Arc, atomic::{AtomicU64, Ordering}}, time::Instant};

/// Counts successful filesystem writes, including writes served by the OS cache.
/// This is not physical-device utilization or network receive throughput.
#[derive(Clone, Default)]
pub struct WriteCounter(Arc<AtomicU64>);
impl WriteCounter {
    pub fn add(&self, bytes: usize) { self.0.fetch_add(bytes as u64, Ordering::Relaxed); }
    pub fn bytes(&self) -> u64 { self.0.load(Ordering::Relaxed) }
}

pub struct WriteRate { previous: u64, at: Instant }
impl WriteRate {
    pub fn new(counter: &WriteCounter) -> Self { Self { previous: counter.bytes(), at: Instant::now() } }
    pub fn sample(&mut self, counter: &WriteCounter) -> u64 {
        self.sample_at(counter, Instant::now())
    }
    fn sample_at(&mut self, counter: &WriteCounter, now: Instant) -> u64 {
        let total = counter.bytes();
        let seconds = now.duration_since(self.at).as_secs_f64();
        let rate = if seconds > 0.0 { (total.saturating_sub(self.previous) as f64 / seconds) as u64 } else { 0 };
        self.previous = total; self.at = now; rate
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rates_are_interval_writes_and_idle_is_zero() {
        let counter = WriteCounter::default(); counter.add(10000);
        let at = Instant::now();
        let mut rate = WriteRate { previous: 10000, at };
        counter.add(2000);
        assert_eq!(rate.sample_at(&counter, at + std::time::Duration::from_secs(1)), 2000);
        assert_eq!(rate.sample_at(&counter, at + std::time::Duration::from_secs(2)), 0);
        let clone = counter.clone(); clone.add(100); assert_eq!(counter.bytes(), 12100);
    }
}
