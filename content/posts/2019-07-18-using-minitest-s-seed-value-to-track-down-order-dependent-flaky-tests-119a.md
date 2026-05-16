---
title: Using Minitest's seed value to track down order-dependent flaky tests
slug: using-minitest-s-seed-value-to-track-down-order-dependent-flaky-tests-119a
date: '2019-07-18'
description: Use Minitest's seed value to re-run your suite in a deterministic order
  to debug order-dependent tests.
tags:
- ruby
- rails
- minitest
- tutorial
reading_time_minutes: 2
dev_to_url: https://dev.to/pezza/using-minitest-s-seed-value-to-track-down-order-dependent-flaky-tests-119a
canonical_url: https://dev.to/pezza/using-minitest-s-seed-value-to-track-down-order-dependent-flaky-tests-119a
---

When you run your test suite, ever wonder why `--seed #####` gets outputted? Let's check it out and see how it's a useful debugging tool.

We will start with a simple test suite:
```ruby
require "minitest/autorun"
require "redis"

class Task
  class << self
    attr_accessor :total_completed
  end

  attr_accessor :completed

  def complete
    Task.total_completed ||= 0
    Task.total_completed += 1
    self.completed = true
  end
end

class TaskTest < Minitest::Test
  def test_global_tracking
    assert Task.total_completed.nil?
  end

  def test_complete
    task = Task.new
    task.complete
    assert task.complete
  end
end
```

This test suite has two tests, one checks that there are no completed tasks and the other tests completing a task. Let's run the suite a few times and see how our tests fair:
```bash
❯ ruby test/flaky_test.rb
Run options: --seed 3199

# Running:

..

Finished in 0.000709s, 2820.8743 runs/s, 2820.8743 assertions/s.
2 runs, 2 assertions, 0 failures, 0 errors, 0 skips

❯ ruby test/flaky_test.rb
Run options: --seed 40573

# Running:

.F

Failure:
TaskTest#test_global_tracking [test/flaky_test.rb:20]:
Expected false to be truthy.


Finished in 0.000956s, 2092.0506 runs/s, 2092.0506 assertions/s.
2 runs, 2 assertions, 1 failures, 0 errors, 0 skips
```

Sure enough, we have a flaky test. The first time running the suite everything passes but the second time it fails at `assert Task.total_completed.nil?`.

Minitest runs all your tests in random order by default to help prevent tests from becoming order-dependent. In the above example, the test failure is caused because we neglected to reset the shared global state between tests. If `test_global_tracking` is run first, the suite will be green but if it is not, we will have a failure. Since this suite is small the bug is easy to spot but when your suite grows to have many test cases, it can become difficult to reproduce the exact scenario that produced the failure.

One crude method I've used over the years to debug this is changing the assertion into an `if`. Then upon failure call `pry` or `puts` the current state of things and then run the test suite inside an infinite loop on the command line until a failure triggers. This method is less than ideal for apps with large suites since it can become quite a time-consuming process to get just the right order.


`seed` to the rescue.


You can use the `seed` value of failed run as a command line option to rerun your tests in that same order.

```bash
❯ ruby test/flaky_test.rb --seed 40573
Run options: --seed 40573

# Running:

.F

Failure:
TaskTest#test_global_tracking [test/flaky_test.rb:20]:
Expected false to be truthy.

Finished in 0.001082s, 1848.4287 runs/s, 1848.4287 assertions/s.
2 runs, 2 assertions, 1 failures, 0 errors, 0 skips

❯ ruby test/flaky_test.rb --seed 40573
Run options: --seed 40573

# Running:

.F

Failure:
TaskTest#test_global_tracking [test/flaky_test.rb:20]:
Expected false to be truthy.

Finished in 0.001134s, 1763.6684 runs/s, 1763.6684 assertions/s.
2 runs, 2 assertions, 1 failures, 0 errors, 0 skips
```

Whohoo 🎉! Now we can dive straight into debugging reliably and skip waiting for our test suite to be in just the right order.
