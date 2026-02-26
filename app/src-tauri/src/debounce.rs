use std::pin::Pin;

use futures::{future::BoxFuture, FutureExt};
use tokio::time::{Duration, Sleep};

#[derive(bon::Builder)]
pub struct Debounce {
    #[builder(default = Duration::from_millis(100))]
    max: Duration,
    sleep: Option<Pin<Box<Sleep>>>,
}

impl Default for Debounce {
    fn default() -> Self {
        Self::builder().build()
    }
}

impl Debounce {
    pub fn trigger(&mut self) {
        if self.sleep.is_none() {
            self.sleep = Some(Box::pin(tokio::time::sleep(self.max)));
        }
    }

    pub fn ready(&mut self) -> BoxFuture<'_, ()> {
        if self.sleep.is_none() {
            return std::future::pending().boxed();
        }

        async move {
            if let Some(sleep) = self.sleep.as_mut() {
                sleep.as_mut().await;
            }
            self.sleep = None;
        }
        .boxed()
    }
}
