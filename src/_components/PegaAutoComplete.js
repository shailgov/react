import React, { Component } from "react";
import { Search } from "semantic-ui-react";
import _ from "lodash";

import { dataPageService } from "../_services";
import { sourceTypes } from "../_constants";

/**
 * Standardized component to handle AutoCompletes sourced from data pages.
 */
class PegaAutoComplete extends Component {
  constructor(props) {
    super(props);

    const { mode } = this.props;
    let source = [];

    // If we are using a local list as source, set its value now
    if (
      mode.listSource === sourceTypes.LOCAL_LIST ||
      mode.listSource === sourceTypes.PAGELIST
    ) {
      // source = mode.options.map(option => {
      //   return { title: option.value, description: option.key };
      // });
      source = this.getAutoCompleteOptions(mode);
    }

    this.state = {
      isLoading: false,
      results: [],
      value: props.value,
      source: source
    };
  }

  /**
   * Get dropdown options ffrom a clipboard page
   * @param { field }
   */

  getAutoCompleteOptions(mode) {
    let options = [];
    if (!mode) return options;

    if (mode && mode.listSource === sourceTypes.PAGELIST) {
      let pageId = mode.clipboardPageID;
      let clipboardPagePrompt = mode.clipboardPagePrompt;
      let clipboardPageValue = mode.clipboardPageValue;
      if (pageId && clipboardPagePrompt && clipboardPageValue) {
        let optionsPage = this.props.caseDetail.content[pageId];
        if (optionsPage && optionsPage.length > 0) {
          options = optionsPage.map(item => {
            return {
              title: item[clipboardPageValue],
              description: item[clipboardPagePrompt]
            };
          });
        }
      }
    } else if (mode && mode.listSource === sourceTypes.LOCAL_LIST) {
      options = mode.options.map(option => {
        return { title: option.value, description: option.key };
      });
    }

    return options;
  }

  componentDidMount() {
    const { mode, pageName, pageParams } = this.props;

    // In the event that the autocomplete is sourced from a DataPage:
    // Directly call dataPageService methods so we do not have actions overhead.
    // This should be very narrow use case, specific to component.
    if (mode.listSource === sourceTypes.DATAPAGE) {
      dataPageService.getDataPage(pageName, pageParams).then(
        dataPage => {
          this.setState({
            source: this.convertDataPageToSource(dataPage)
          });
        },
        error => {
          this.setState({
            source: [{ key: error, text: error, value: error }]
          });
        }
      );
    }
  }

  convertDataPageToSource(dataPage) {
    let { propertyName, propertyPrompt } = this.props;
    let source = [];

    if (propertyName.indexOf(".") === 0) {
      propertyName = propertyName.substring(1);
    }

    dataPage.pxResults.forEach(result => {
      if (result[propertyName]) {
        source.push({
          title: result[propertyName],
          description: result[propertyPrompt]
        });
      }
    });

    return source;
  }

  handleResultSelect = (e, { result }) => {
    // This is needed because otherwise we get a warning that we are accessing preventDefault() on a released
    // instances of the synthetic object. Only will be needed for AutoComplete and for small # of cases.
    if (!e) return;
    e.persist();

    this.setState({ value: result.title });
    this.props.onChange(
      e,
      {
        value: result.title,
        reference: this.props.reference
      },
      this.props.onResultSelect
    );
  };

  handleSearchChange = (e, { value }) => {
    this.setState({ isLoading: true, value });

    setTimeout(() => {
      if (this.state.value.length < 1)
        return this.setState({ isLoading: false, results: [], value: "" });

      const re = new RegExp(_.escapeRegExp(this.state.value), "i");
      const isMatch = result => re.test(result.title);

      this.setState({
        isLoading: false,
        results: _.filter(this.state.source, isMatch)
      });
    }, 300);
  };

  render() {
    const tooltip = { ...this.props.tooltip };
    return (
      <div className="field">
        <label>{this.props.label}</label>
        <Search
          loading={this.state.isLoading}
          onResultSelect={this.handleResultSelect}
          onSearchChange={_.debounce(this.handleSearchChange, 500, {
            leading: true
          })}
          results={this.state.results}
          value={this.state.value}
          {...tooltip}
        />
      </div>
    );
  }
}

export { PegaAutoComplete };
