require "lib/email"

###
# Page options, layouts, aliases and proxies
###

# Per-page layout changes:
#
# With no layout
page '/*.xml', layout: false
page '/*.json', layout: false
page '/*.txt', layout: false

# With alternative layout
# page "/path/to/file.html", layout: :otherlayout

# Proxy pages (http://middlemanapp.com/basics/dynamic-pages/)
# proxy "/this-page-has-no-template.html", "/template-file.html", locals: {
#  which_fake_page: "Rendering a fake page with a local variable" }

# General configuration

###
# Helpers
###

# Methods defined in the helpers block are available in templates
helpers do
  def projects
    {
      wnw: "Working Not Working",
      n2: "N2 Publishing",
      archipelago: "Archipelago",
      github: "Open Source Contributions",
      cal: "California University of PA Class Advisor",
      spoonflower: "Spoonflower",
    }
  end
end

# Build-specific configuration
configure :build do
  activate :asset_hash
  # Minify CSS on build
  # activate :minify_css

  # Minify Javascript on build
  # activate :minify_javascript
end
