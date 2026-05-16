---
title: Dynamic nested forms with Turbo
slug: dynamic-nested-forms-with-turbo-3786
date: '2022-06-04'
description: Prior to the advent of Turbo and Stimulus, my go-to for creating dynamic
  nested forms was Cocoon...
tags:
- turbo
- ruby
- rails
- hotwire
reading_time_minutes: 7
dev_to_url: https://dev.to/pezza/dynamic-nested-forms-with-turbo-3786
canonical_url: https://dev.to/pezza/dynamic-nested-forms-with-turbo-3786
cover_image: https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F74upl0vmwzrd7s03tpeh.png
---

Prior to the advent of Turbo and Stimulus, my go-to for creating dynamic nested forms was [Cocoon](https://github.com/nathanvda/cocoon) which has been around a while and uses jQuery. Tried and true.

Once Stimulus came out, [Chris Oliver](https://github.com/excid3) from [GoRails](https://gorails.com/episodes/dynamic-nested-forms-with-stimulus-js?autoplay=1) re-implemented Cocoons functionality using Stimulus. This iteration was simplified and removed the dependency on Cocoon and jQuery. 

Let's try a new implementation of dynamic nested forms without using any JavaScript!

### Getting started 

For this example, we'll make a checklist app that has projects and tasks. 
```shell
rails new checklist
cd checklist
rails generate scaffold project description name
rails generate model task description project:belongs_to
rails db:migrate
```

To start, We need to update our `Project` model to accept attributes for tasks:

```ruby
# app/models/project.rb
class Project < ApplicationRecord
  has_many :tasks
  accepts_nested_attributes_for :tasks, 
    reject_if: :all_blank, allow_destroy: true
end
```

With `Project` aware of tasks, let's modify the `Project` form to render any associated `Task` fields.

```eruby
<%# app/views/projects/_form.html.erb %>
<%= form_with(model: project) do |form| %>
  <% if project.errors.any? %>
    <div style="color: red">
      <h2><%= pluralize(project.errors.count, "error") %> prohibited this project from being saved:</h2>

      <ul>
        <% project.errors.each do |error| %>
          <li><%= error.full_message %></li>
        <% end %>
      </ul>
    </div>
  <% end %>

  <div>
    <%= form.label :name, style: "display: block" %>
    <%= form.text_field :name %>
  </div>

  <div>
    <%= form.label :description, style: "display: block" %>
    <%= form.text_field :description %>
  </div>

  <h4>Tasks</h4>
  <div>
    <%= form.fields_for :tasks do |task_form| %>
      <%= task_form.hidden_field :id %>

      <div>
        <%= task_form.label :description, style: "display: block" %>
        <%= task_form.text_field :description %>
      </div>
    <% end %>
  </div>

  <div>
    <%= form.submit %>
  </div>
<% end %>
```

When we start up the rails server and go to `http://localhost:3000/projects/new`, no tasks get shown. 
This is because, in our controller, when we instantiate a `Project`, we aren't building any associated `Task`s. We can change that by altering the `new` action in the `ProjectsController`. 

```ruby
# app/controllers/projects_controller.rb
class ProjectsController < ApplicationController
  [...]
  def new
    @project = Project.new(tasks: [Task.new])
  end
  [...]
end
```
Once we reload the page, we now have see the fields for a `Task` being rendered.

To successfully submit this form, though, we need to modify our permitted parameters in the `ProjectsController`.

```ruby
# app/controllers/projects_controller.rb
class ProjectsController < ApplicationController
  [...]
  private

  def project_params
    params.require(:project).
      permit(:name, :description, tasks_attributes: 
        [:id, :description, :_destroy])
  end
  [...]
end
```
When we added `accepts_nested_attributes_for` in our `Project` model, it created a method `tasks_attributes=(attrs)` that takes in a hash of tasks that it can then use to construct `Task` objects. We'll dive more into the structure of the `attrs` hash in a bit. You can read more about `accepts_nested_attributes_for` [here](https://api.rubyonrails.org/classes/ActiveRecord/NestedAttributes/ClassMethods.html).

Now when we submit this form, a new `Project` is created along with a new associated `Task`. 

Next, we'll move the form inputs for `Task`s into their own partial so we can reuse it later. 

```eruby
<%# app/views/tasks/_form.html.erb %>
<%= form.hidden_field :id %>

<div>
  <%= form.label :description, style: "display: block" %>
  <%= form.text_field :description %>
</div>
```

While updating the `Project` form to use the new `Task` form partial we are also going to add an `id` to the surrounding `div` so that we can target it in the future with turbo streams.

```eruby
<%# app/views/projects/_form.html.erb %>
[...]
<h4>Tasks</h4>
<div id="tasks">
  <%= form.fields_for :tasks do |task_form| %>
    <%= render "tasks/form", form: task_form %>
  <% end %>
</div>
[...]
```

### Child Index

Before going any further we have to understand how `fields_for` works, and how the `tasks_attributes=` method works.

We'll take a look at `tasks_attributes=` first. 

Using the form submission parameters in our server log, we can see what the `tasks_attributes` parameter looks like. 
```ruby
Parameters: {"authenticity_token"=>"[FILTERED]", "project"=>
{"name"=>"project 1", "description"=>"first project", 
"tasks_attributes"=>{"0"=>{"description"=>"task 1"}}}, 
"commit"=>"Create Project"}
```

You might be thinking 'What's up with that `"0"` key?'. That is used as a way for Rails and Rack to uniquely identify each task in our form. When we are dynamically adding new tasks, they won't yet have database ids assigned to them so we need to assign them a temporary identifier to distinguish unique tasks sent to the server. In this case, `fields_for` uses a zero-based index.

If we were to have two tasks on our form (you can do this by updating the `new` action in our `ProjectsController` to build two `Task`s on our `Project` instead of one) and submit the form you would see parameters that would look like:
```ruby
{ "tasks_attributes"=>{"0"=>{"description"=>"task 1" }, 
"1"=>{"description"=>"task 2" } } }
```

Let's move over to look at `fields_for` now. 
Calling `f.fields_for :tasks do |task_form|` in our form will call the `tasks` method on `@project` and then loop through each `task` creating a scoped form builder. With the scoped form builder we can output the inputs for a `Task`. 

If we open our browser and inspect the tasks description text field we'll see it has a name of `project[tasks_attributes][0][description]`. For our `Project` fields the name looks something like `project[name]`. Calling `fields_for` will add the `[tasks_attributes]` scope and since Rails knows this is a `has_many` relationship it will add the index as another scope to uniquely identify specific tasks.

We can alter this index by passing in a `child_index` parameter on `fields_for`. In our `Project`s form partial if we update our `fields_for` call to be `<%= form.fields_for :tasks, child_index: "FOOBAR" do |task_form| %>` and inspect our description field, the fields name is now, `project[tasks_attributes][FOOBAR][description]`.

With this knowledge, we can better understand how past implementations of this trick were done. We would render the task form inputs out somewhere hidden on the page, with an easily identifying `child_index`. Then when we want to add a new task, we copy the template, `gsub` the `child_index` for a unique number, and then paste the template into the DOM tree. For removing, we would hide all the inputs, find the `_destroy` hidden input, and set it to true. 

Let's move on to adding the dynamic parts to our form. 

### Dynamically removing tasks

We'll start by wrapping the `Task`s form inputs in a `turbo_frame`.
```eruby
<%= turbo_frame_tag "task_#{form.index}" do %>
  <%= form.hidden_field :id %>

  <div>
    <%= form.label :description, style: "display: block" %>
    <%= form.text_field :description %>
  </div>
<% end %>
```
Using the `child_index`(found by calling `index` on the form object) in the turbo_frame id allows us to manipulate the fields for just that `Task`.

Next we are going to need a controller for `Task`s so that we can remove one. Unlike normal resourceful routes, the route for removing a task requires we pass it the `child_index` since it identifies the `turbo_frame` we want to target. 
We also need an optionally id parameter because when we are editing a `Project` we might want to delete an existing `Task`, in which case, we will need to pass the database id back to the server so it knows which `Task` to destroy.

```ruby
# config/routes.rb
Rails.application.routes.draw do
  resources :projects

  resources :tasks, only: [], param: :index do
    member do
      delete '(:id)' => "tasks#destroy", as: ""
    end
  end
end
```

This creates the route:
```
Prefix Verb   URI Pattern                   Controller#Action
  task DELETE /tasks/:index(/:id)(.:format) tasks#destroy
```

In the controller we need to setup one `Project` and one `Task`.

```ruby
# app/controllers/tasks_controller.rb
class TasksController < ApplicationController
  def destroy
    @project = Project.new(tasks: [Task.new])
  end
end
```

A `Project` needs to be setup because we are going to recreate the form with different inputs.

```eruby
<%# app/views/tasks/destroy.html.slim %>
<%= fields model: @project do |form| %>
  <%= form.fields_for :tasks, child_index: params[:index] do |task_form| %>
    <%= turbo_frame_tag "task_#{task_form.index}" do %>
      <%= task_form.hidden_field :id, value: params[:id] %>
      <%= task_form.hidden_field :_destroy, value: true %>
    <% end %>
  <% end %>
<% end %>
```

This view recreates the `Project` form with a `Task` but this time there are a few differences. 
1. We are using the `fields` method rather than the `form_with` method because we don't need to render the actual HTML form element we just need a form builder instance. 
2. We pass the `index` param as the `child_index`. 
3. We change the form inputs in the turbo frame to be just the `id` and `_destroy` inputs.

Now let's go back to the tasks `form` partial and add a button to trigger this. 

```eruby
<%# app/views/tasks/_form.html.erb %>
<%= turbo_frame_tag "task_#{form.index}" do %>
  <%= form.hidden_field :id %>

  <div>
    <%= form.label :description, style: "display: block" %>
    <%= form.text_field :description %>
  </div>

  <%= form.submit "destroy task", 
        formaction: task_path(form.index, form.object.id), 
        formmethod: :delete, 
        formnovalidate: true, 
        data: { turbo_frame: "task_#{form.index}" } %>
<% end %>
```
Here we take advantage of the `formaction` and `formmethod` attribute of submit buttons inside the form to submit a `DELETE` request over to our destroy action of `Task`s, targeting this turbo frame. 

After reloading the page, clicking this button removes our task from the form! Hooray! Now on to adding tasks.

### Dynamically adding tasks

Just like removing, let's add a new route:
```ruby
# config/routes.rb
Rails.application.routes.draw do
  resources :projects

  resources :tasks, only: [], param: :index do
    member do
      delete '(:id)' => "tasks#destroy", as: ""
      post '/' => "tasks#create"
    end
  end
end
```

Our new route looks like:
```
POST   /tasks/:index(.:format)       tasks#create
```

In this case, we don't have need the optional id parameter since this is always a brand new record.

Now let's add a button on our `Project` form to add new tasks.

```eruby
<%# app/views/projects/_form.html.erb %>
[...]
<h4>Tasks</h4>
<div id="tasks">
  <%= form.fields_for :tasks do |task_form| %>
    <%= render "tasks/form", form: task_form %>
  <% end %>
</div>

<%= form.submit "Add task", 
      formaction: task_path(@project.tasks.size), 
      formmethod: :post, 
      formnovalidate: true, 
      id: "add-task" %>
[...]
```

We need an `id` on our submit button so we can replace the `formaction` with an updated index when we add a new task to the form. 

Next, we'll move to our `TasksController` and setup our `new` method. Since it is going to be identical to our `destroy` method we can do some cleanup.

```ruby
# app/controllers/tasks_controller.rb
class TasksController < ApplicationController
  before_action :setup_project

  def new
  end

  def destroy
  end

  private

  def setup_project
    @project = Project.new(tasks: [Task.new])
  end
end
```

Now for our create template. In this case we are going to use a turbo_stream template.

```eruby
<%# app/views/tasks/create.turbo_stream.erb %>
<%= fields model: @project do |form| %>
  <%= form.fields_for :tasks, child_index: params[:index] do |task_form| %>
    <%= turbo_stream.replace "add-task" do %>
      <%= form.submit "Add task", 
            formaction: task_path(task_form.index.to_i + 1), 
            formmethod: :post, 
            formnovalidate: true, 
            id: "add-task" %>
    <% end %>

    <%= turbo_stream.append "tasks" do %>
      <%= render "form", form: task_form %>
    <% end %>
  <% end %>
<% end %>
```

The first stream replaces our `Add task` button with a new one that has a new `formaction` pointing to the next index. 

The second stream, appends to the `#tasks` element a new task form.

If we reload the page and click the "Add task" button, BOOM! A new task is added to the form and we can then remove it. 


![Demo](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/yv06e93sto2w9jagdlo3.gif)
