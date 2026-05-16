---
title: RediSearch on Rails
slug: redisearch-on-rails-581p
date: '2019-08-03'
description: If you are using Rails, chances are you are using Redis for something
  whether it is as a cache, Actio...
tags:
- ruby
- rails
- redisearch
- tutorial
reading_time_minutes: 5
dev_to_url: https://dev.to/pezza/redisearch-on-rails-581p
canonical_url: https://dev.to/pezza/redisearch-on-rails-581p
---

If you are using Rails, chances are you are using Redis for something whether it is as a cache, ActionCable, or ActiveJob. So why not use it for one more thing?

Starting in v4 of Redis, Redis Modules were introduced which are add ons built to extend Redis' functionality. One of the first modules was RediSearch, a text search engine built on top of Redis. According to [RediSearch.io](https://redisearch.io):

> Unlike other Redis search libraries, it does not use the internal data
> structures of Redis like sorted sets. Using its own highly optimized data
> structures and algorithms, it allows for advanced search features, high
> performance, and low memory footprint. It can perform simple text searches, as
> well as complex structured queries, filtering by numeric properties and
> geographical distances. RediSearch supports continuous indexing with no
> performance degradation, maintaining concurrent loads of querying and
> indexing. This makes it ideal for searching frequently updated databases,
> without the need for batch indexing and service interrupts. 

Some of the headline features of RediSearch include: 
* Full-Text indexing of multiple fields in a document, including:
    * Exact phrase matching.
    * Stemming in many languages.
    * Prefix queries.
    * Optional, negative and union queries.
* Distributed search on billions of documents.
* Numeric property indexing.
* Geographical indexing and radius filters.
* Incremental indexing without performance loss.
* A powerful auto-complete engine with fuzzy matching.
* Concurrent low-latency insertion and updates of documents.
* This [benchmark](https://redislabs.com/blog/search-benchmarking-redisearch-vs-elasticsearch/) against ElasticSearch!

Let's walk through how to get RediSearch integrated into your Rails app!
 
First, start out by installing Redis and RediSearch. Check out [Redis.io](https://redis.io/download) for full installation instructions for Redis. If Homebrew is available you can `brew install redis`. As of v1.6, to build RediSearch do the following:
1. git clone https://github.com/RediSearch/RediSearch.git
1. cd RediSearch
1. make

Once RediSearch is built you will need to tell Redis to load the module. The best way is to add `loadmodule /path/to/redisearch.so` to your redis.conf file to always load the module. (On macOS the redis.conf file can be found at `/usr/local/etc/redis.conf`). Once the conf file has been updated restart Redis. For full instructions on installing RediSearch visit [RediSearch.io](https://oss.redislabs.com/redisearch/Quick_Start.html).

Alternatively, you can run Redis and RediSearch with Docker using `docker run -p 6379:6379 redislabs/redisearch:latest`.

Once Redis and RediSearch are installed add the `redi_search` gem to your Gemfile:
```ruby
gem 'redi_search'
```
and then run `bundle install`. Or you can install from the [GitHub package registry](https://github.com/npezza93/redi_search/packages/12707). 

Once installed we'll need to make an initializer to configure our Redis connection.
```ruby
# config/initializers/redi_search.rb
RediSearch.configure do |config|
  config.redis_config = {
    host: "127.0.0.1",
    port: "6379"
  }
end
```

Now that we have RediSearch available in our app, let's use it to index a model. We'll use a `User` model with `first` and `last` attributes as an example.

```ruby
class User < ApplicationRecord
  redi_search schema: {
    first: { text: { phonetic: "dm:en" } },
    last: { text: { phonetic: "dm:en" } }
  }
end
```
Calling the `redi_search` class method inside a model accepts one required named parameter called `schema`. This defines the fields inside an index and the attributes for those fields. RediSearch has text, numeric, geo, and tag fields. The phonetic option was passed above because we are indexing names and it makes it easier to search for names with similar sounds but spelled differently. The full list of available options for the different field types can be found [here](https://github.com/npezza93/redi_search#schema).

```ruby
User.reindex
```
Calling the `redi_search` class method inside a model adds a couple of useful methods, including `reindex` which does a couple of things:
1. Creates the index if it doesn't exist
2. Calls the `search_import` scope to fetch all the records from the database
3. Converts those records to RediSearch `Document`s
4. Indexes all those documents into Redis

```ruby
User.search("jak")
```

Now that we have all of our users indexed we can start searching for them. Querying is similar to the ActiveRecord interface where clauses and conditions can be chained together and the search is executed lazily​. Some simple queries are:

```ruby
# simple phrase query - jak AND daxter
User.search("jak").and("daxter")

# exact phrase query - jak FOLLOWED BY daxter
User.search("jak daxter")

# union query - jak OR daxter
User.search("jak").or("daxter")

# negation query - jak AND NOT daxter
User.search("jak").and.not("daxter")
```

Some more complex queries are:
```ruby
# intersection of unions - (hello OR halo) AND (world OR werld)
User.search(User.search("hello").or("halo")).and(User.search("world").or("werld"))
# negation of union - hello AND NOT (world or werld)
User.search("hello").and.not(User.search("world").or("werld"))
# union inside phrase - hello AND (world OR werld)
User.search("hello").and(User.search("world").or("werld"))
```

All terms support a few options that can be applied.

**Prefix terms**: match all terms starting with a prefix. (Akin to `like term%` in SQL)
```ruby
User.search("hel", prefix: true)
User.search("hello worl", prefix: true)
User.search("hel", prefix: true).and("worl", prefix: true)
User.search("hello").and.not("worl", prefix: true)
```

**Optional terms**: documents containing the optional terms will rank higher than those without
```ruby
User.search("foo").and("bar", optional: true).and("baz", optional: true)
```

**Fuzzy terms**: matches are performed based on Levenshtein distance. The maximum Levenshtein distance supported is 3.
```ruby
User.search("zuchini", fuzziness: 1)
```

Search terms can also be scoped to specific fields using a `where` clause:
```ruby
# Simple field specific query
User.search.where(name: "john")
# Using where with options
User.search.where(first: "jon", fuzziness: 1)
# Using where with more complex query
User.search.where(first: User.search("bill").or("bob"))
```

Searching for numeric fields accepts a range:
```ruby
User.search.where(number: 0..100)
# Searching to infinity
User.search.where(number: 0..Float::INFINITY)
User.search.where(number: -Float::INFINITY..0)
```

When searching, by default a collection of `Document`s is returned. Calling `#results` on the search query will execute the search, and then look up all the found records in the database and return an ActiveRecord relation.

Another useful method `redi_search` adds is `spellcheck` and responds with suggestions for misspelled search terms.


```ruby
User.spellcheck("jimy")
  RediSearch (1.1ms)  FT.SPELLCHECK user_idx jimy DISTANCE 1
=> [#<RediSearch::Spellcheck::Result:0x00007f805591c670
    term: "jimy",
    suggestions:
     [#<struct RediSearch::Spellcheck::Suggestion score=0.0006849315068493151, suggestion="jimmy">,
      #<struct RediSearch::Spellcheck::Suggestion score=0.00019569471624266145, suggestion="jim">]>]
User.spellcheck("jimy", distance: 2).first.suggestions
  RediSearch (0.5ms)  FT.SPELLCHECK user_idx jimy DISTANCE 2
=> [#<struct RediSearch::Spellcheck::Suggestion score=0.0006849315068493151, suggestion="jimmy">,
 #<struct RediSearch::Spellcheck::Suggestion score=0.00019569471624266145, suggestion="jim">]
```

Next time you are looking for a search engine give RediSearch a try! You can read about more options and see more examples on the README:

{% github npezza93/redi_search %}
