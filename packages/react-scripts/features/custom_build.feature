Feature: Custom build
  As a dev
  I want to customize the build output of my CRA
  In order to make it easier to integrate it with API backends such as Elixir/Phoenix, Rails, etc.

  # NOTICE: this is just a textual specification.
  # TODO(?): Install Cucumber or similar for BDD

  Background:
    Given a CRA app using @iporaitech/react-scripts

  Scenario Outline: Customize output
    Given CRA_BUILD_OUTPUT_PATH=<OUTPUT_PATH>
    And CRA_BUILD_PUBLIC_PATH=<PUBLIC_PATH>
    When I execute `yarn build:dev` or `yarn build:prod`
    Then the dir <OUTPUT_DIR> should be cleared
    And new js, css, media and other related files and dirs should be generated in it
    And the dynamic chunks should use <PUBLIC_PATH> as its public path

    Examples:
      # NOTICE: public_path is / by default and as in webpack, it should end with /
      | OUTPUT_PATH                 | PUBLIC_PATH | OUTPUT_DIR                                         |
      | /webapp/static              | /           | /webapp/static                                     |
      | /webapp/priv/static         | /           | /webapp/priv/static                                |
      | /webapp/priv/static/ui      | /ui/        | /webapp/priv/static/ui                             |
      | /webapp/priv/static/ui/core | /ui/core/   | /webapp/priv/static/ui/core                        |
      | undefined                   | /           | build/development in app dir when `yarn build:dev  |
      | undefined                   | /           | build/production in app dir when `yarn build:prod` |

  Scenario: watch mode
    When I execute `yarn build:dev --watch`
    Then the script runs webpack in watch mode

  Scenario: production
    # filename DOES NOT include hash in even production. It's expected this
    # to be handled by the backend API, i.e.: `mix phx.digest`
    # However, chunkFilenames should include them because of code-splitting
    When I execute `yarn build:prod`
    Then the output files and initial chunks should not have a hash

