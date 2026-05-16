---
title: How to paginate items using Turbo
slug: how-to-paginate-items-using-turbo-1862
date: '2020-12-22'
description: Basecamp recently released Hotwire which includes Turbo. Using Turbo,
  we can quickly paginate a long...
tags:
- turbo
- ruby
- rails
reading_time_minutes: 3
dev_to_url: https://dev.to/pezza/how-to-paginate-items-using-turbo-1862
canonical_url: https://dev.to/pezza/how-to-paginate-items-using-turbo-1862
cover_image: https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fi%2F86gi5dbhdxhdzmbttwv4.png
---

Basecamp recently released [Hotwire](https://hotwire.dev) which includes [Turbo](https://turbo.hotwire.dev). Using Turbo, we can quickly paginate a long list of items that can be asynchronously loaded without any javascript.

Let's say we have an app that lists credit card transactions. This list can become very long which we wouldn't want to load upfront due to the performance impact. To avoid loading all the transactions upon page load but, still allow our users to see all transactions, we will only render the first few transactions initially and then show a "Load More" link. The "Load More" link will grab more transactions, append them to the existing list of transactions, and then update our "Load More" link to point to a new URL for the next collection of transactions.

(Note: We are going to use [Geared Pagination](https://github.com/basecamp/geared_pagination) for pagination but this solution will work with any pagination solution so long as you know the current and next page numbers.) 

Here's where our app currently stands:
![](https://user-images.githubusercontent.com/5059927/102933924-30768900-4471-11eb-968b-5dcce9025ef9.png)


```ruby
# app/views/transactions_controller.rb
class TransactionsController < ApplicationController
  def index
    set_page_and_extract_portion_from(Transaction.all)

    respond_to do |format|
      format.html
      format.js
     end
  end 
end
```

```erb
<%# app/views/transactions/index.html.erb %>
<p id="notice"><%= notice %></p>
<div>
  <%= link_to 'New Transaction', new_transaction_path %>
</div>

<h1>Transactions</h1>

<div>
  <ul><%= render @page.records %></ul>

  <% unless @page.last? %>
    <%= link_to "Load More", transactions_path(page: @page.next_param), remote: true, id: "load-more" %>
  <% end %>
</div>
```

```erb
<%# app/views/transactions/index.js.erb %>
document.querySelector("ul").insertAdjacentHTML("beforeend", "<%= j render partial: @page.records, as: :transaction %>");

<% if @page.last? %>
  document.querySelector("#load-more").remove();
<% else %>
  document.querySelector("#load-more").href = "<%= transactions_path(page: @page.next_param) %>";
<% end %>
```

This solution works fine. Code is pretty concise and explicit, but we are using a separate js.erb view which we now also have to maintain along with the html.erb view for the index action.

Using Turbo we can remove `app/views/transactions/index.js.erb` and the `respond_to` block in the controller since we will only be responding to HTML. 

In `app/views/transactions/index.html.erb` we will make the following changes inside the `ul` element:
```erb
<ul>
  <%= turbo_frame_tag "transactions-#{@page.number}" do %>
    <%= render @page.records %>
    <%= turbo_frame_tag "transactions-#{@page.next_param}" do %>
      <% unless @page.last? %>
        <%= link_to "Load More", transactions_path(page: @page.next_param) %>
      <% end %>
    <% end %>
  <% end %>
</ul>
```

If we reload our page and try it out, it works!
![Screen Recording 2020-12-22 at 4.43.06 PM](https://dev-to-uploads.s3.amazonaws.com/i/ekn81rysz8tzq50tnq5z.gif)
  
The trick to making this work is nesting the turbo-frames. On this first page, our outer frame has the id of `transactions-1` and the inner one has the id of `transactions-2`. When we click the "Load More" link the server is going to respond with the inner HTML of the `body` element of what page 2 looks like. In that case, our outer frame has the id of `transactions-2` and our inner one has the id of `transactions-3`. Once we get that response, Turbo will replace any frames that occur on the initial page **and** on the one sent back. 

Since the `transactions-1` `turbo-frame` doesn't appear on the second page, nothing happens to it. But there is a `transactions-2` `turbo-frame` on both our first and second pages so that frame is replaced. That new frame will render the `Transaction`'s on the second page right below the first page's transactions, and remove the first page's "Load More" and replace it with a "Load More" link to the third page. Our HTML would end up looking something like:

```erb
<ul>
  <%= turbo_frame_tag "transactions-1" do %>
    <%= render @page.records %> <%# page 1 records %>
    <%= turbo_frame_tag "transactions-2" do %>
      <%= render @page.records %> <%# page 2 records %>
      <%= turbo_frame_tag "transactions-3" do %>
        <%= link_to "Load More", transactions_path(page: 3) %>
      <% end %>
    <% end %>
  <% end %>
</ul>
```

Magic 🪄!

(Note: Styling could become an issue with this solution with elements being nested inside turbo-frame tags but so far I haven't run into any issues.)
