import React, { type FC, useState, useEffect, useCallback, useRef } from 'react';
import { inputs, widget } from '@wix/editor';
import {
  SidePanel,
  WixDesignSystemProvider,
  Input,
  FormField,
  RadioGroup,
  NumberInput,
  ToggleSwitch,
  Dropdown,
  SectionHelper,
  Box,
  Button,
  Divider,
  FillPreview,
  Text,
  TextButton,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

import { defaultProps } from '../../components/auction-products/auction-products.props';
import { SUPPORTED_LANGUAGE_OPTIONS } from '../../../../site/shared/languageCodes';
import { DESIGN_ELEMENTS, parseDesign, type ElementDesign, type WidgetDesign } from './design';

const DESIGN_ELEMENT_OPTIONS = DESIGN_ELEMENTS.map((element) => ({ id: element.id, value: element.label }));

const Panel: FC = () => {
  const [headerTitle, setHeaderTitle] = useState<string>(defaultProps.headerTitle);
  const [headerSubtitle, setHeaderSubtitle] = useState<string>(defaultProps.headerSubtitle);
  const [layout, setLayout] = useState<string>(defaultProps.layout);
  const [pageSize, setPageSize] = useState<number>(defaultProps.pageSize);
  const [auctionFilter, setAuctionFilter] = useState<string>(defaultProps.auctionFilter);
  const [language, setLanguage] = useState<string>(defaultProps.language);
  const [autoDetectLanguage, setAutoDetectLanguage] = useState<boolean>(defaultProps.autoDetectLanguage);
  const [design, setDesign] = useState<WidgetDesign>({});
  const designRef = useRef<WidgetDesign>({});
  const [designElementId, setDesignElementId] = useState<string>(DESIGN_ELEMENTS[0].id);

  useEffect(() => {
    Promise.all([
      widget.getProp('header-title'),
      widget.getProp('header-subtitle'),
      widget.getProp('layout'),
      widget.getProp('page-size'),
      widget.getProp('auction-filter'),
      widget.getProp('language'),
      widget.getProp('auto-detect-language'),
      widget.getProp('design'),
    ])
      .then(([title, subtitle, layoutProp, pageSizeProp, filterProp, langProp, autoDetectProp, designProp]) => {
        const loadedDesign = parseDesign(designProp);
        designRef.current = loadedDesign;
        setDesign(loadedDesign);
        if (title !== undefined && title !== null) {
          setHeaderTitle(title);
        }
        if (subtitle !== undefined && subtitle !== null) {
          setHeaderSubtitle(subtitle);
        }
        if (layoutProp) {
          setLayout(layoutProp);
        }
        if (pageSizeProp) {
          const parsed = parseInt(pageSizeProp, 10);
          if (!isNaN(parsed)) {
            setPageSize(parsed);
          }
        }
        if (filterProp) {
          setAuctionFilter(filterProp);
        }
        if (langProp) {
          setLanguage(langProp);
        }
        if (autoDetectProp !== undefined && autoDetectProp !== null) {
          setAutoDetectLanguage(autoDetectProp !== 'false');
        }
      })
      .catch((err) => {
        console.error('Failed to load widget properties in settings panel:', err);
      });
  }, []);

  const handleHeaderTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHeaderTitle(val);
    widget.setProp('header-title', val);
  }, []);

  const handleHeaderSubtitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHeaderSubtitle(val);
    widget.setProp('header-subtitle', val);
  }, []);

  const handleLayoutChange = useCallback((value?: string | number) => {
    if (value === undefined || value === null) {
      return;
    }
    const val = String(value);
    setLayout(val);
    widget.setProp('layout', val);
  }, []);

  const handlePageSizeChange = useCallback((value: number | null | undefined) => {
    if (value !== null && value !== undefined) {
      setPageSize(value);
      widget.setProp('page-size', String(value));
    }
  }, []);

  const handleAuctionFilterChange = useCallback((value?: string | number) => {
    if (value === undefined || value === null) {
      return;
    }
    const val = String(value);
    setAuctionFilter(val);
    widget.setProp('auction-filter', val);
  }, []);

  const handleLanguageSelect = useCallback((option: any) => {
    if (option?.id) {
      const val = String(option.id);
      setLanguage(val);
      widget.setProp('language', val);
    }
  }, []);

  const handleAutoDetectLanguageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setAutoDetectLanguage(val);
    widget.setProp('auto-detect-language', String(val));
  }, []);

  // Reads the latest design from a ref so picker callbacks never write a stale copy.
  const updateElementDesign = useCallback((elementId: string, patch: ElementDesign | null) => {
    const next = { ...designRef.current };
    if (patch) {
      next[elementId] = { ...next[elementId], ...patch };
    } else {
      delete next[elementId];
    }
    designRef.current = next;
    setDesign(next);
    widget.setProp('design', JSON.stringify(next));
  }, []);

  const designElement = DESIGN_ELEMENTS.find((element) => element.id === designElementId) ?? DESIGN_ELEMENTS[0];
  const elementDesign = design[designElement.id] ?? {};

  const handleSelectFont = useCallback(() => {
    const elementId = designElement.id;
    const current = designRef.current[elementId];
    inputs.selectFont(
      current?.font ? { font: current.font, textDecoration: current.textDecoration } : undefined,
      {
        onChange: (value) => {
          if (value?.font) {
            updateElementDesign(elementId, { font: value.font, textDecoration: value.textDecoration || '' });
          }
        },
      },
    );
  }, [designElement.id, updateElementDesign]);

  const handleSelectColor = useCallback(
    (property: 'color' | 'background') => {
      const elementId = designElement.id;
      inputs.selectColor(designRef.current[elementId]?.[property], {
        onChange: (value) => {
          if (value) {
            updateElementDesign(elementId, { [property]: value });
          }
        },
      });
    },
    [designElement.id, updateElementDesign],
  );

  const languageOptions = SUPPORTED_LANGUAGE_OPTIONS.map((opt) => ({
    id: opt.id,
    value: opt.value,
  }));

  return (
    <WixDesignSystemProvider>
      <SidePanel width="320" height="100vh">
        <SidePanel.Header title="Auction Products Settings" />
        <SidePanel.Content stretchVertically>
          <SidePanel.Field>
            <FormField label="Header Title">
              <Input
                type="text"
                value={headerTitle}
                onChange={handleHeaderTitleChange}
                placeholder="Live auctions"
              />
            </FormField>
          </SidePanel.Field>

          <SidePanel.Field>
            <FormField label="Header Subtitle">
              <Input
                type="text"
                value={headerSubtitle}
                onChange={handleHeaderSubtitleChange}
                placeholder="Bid on one-of-a-kind products before the timer runs out."
              />
            </FormField>
          </SidePanel.Field>

          <SidePanel.Field>
            <FormField label="Layout">
              <RadioGroup
                value={layout}
                onChange={handleLayoutChange}
              >
                <RadioGroup.Radio value="grid">Grid (wrap cards into rows)</RadioGroup.Radio>
                <RadioGroup.Radio value="carousel">Carousel (single scrollable row)</RadioGroup.Radio>
              </RadioGroup>
            </FormField>
          </SidePanel.Field>

          <SidePanel.Field>
            <FormField label="Default Product Filter" infoContent="Initial filter applied when visitors load products">
              <RadioGroup
                value={auctionFilter}
                onChange={handleAuctionFilterChange}
              >
                <RadioGroup.Radio value="active">Linked to auction (default)</RadioGroup.Radio>
                <RadioGroup.Radio value="all">All products</RadioGroup.Radio>
                <RadioGroup.Radio value="inactive">Inactive products</RadioGroup.Radio>
              </RadioGroup>
            </FormField>
          </SidePanel.Field>

          <SidePanel.Field>
            <FormField label="Products Per Page" infoContent="Number of items loaded per page (4 to 60)">
              <NumberInput
                value={pageSize}
                min={4}
                max={60}
                step={4}
                onChange={handlePageSizeChange}
              />
            </FormField>
          </SidePanel.Field>

          <SidePanel.Field>
            <FormField label="Auto-detect Visitor Language">
              <ToggleSwitch
                checked={autoDetectLanguage}
                onChange={handleAutoDetectLanguageChange}
              />
            </FormField>
          </SidePanel.Field>

          <SidePanel.Field>
            <FormField label="Fallback Language" infoContent="Used when visitor language cannot be detected">
              <Dropdown
                options={languageOptions}
                selectedId={language}
                onSelect={handleLanguageSelect}
              />
            </FormField>
          </SidePanel.Field>

          <Divider />

          <SidePanel.Field>
            <FormField label="Design" infoContent="Choose an element, then set its font and colors">
              <Dropdown
                options={DESIGN_ELEMENT_OPTIONS}
                selectedId={designElement.id}
                onSelect={(option) => option?.id && setDesignElementId(String(option.id))}
              />
            </FormField>
          </SidePanel.Field>

          {designElement.properties.includes('font') ? (
            <SidePanel.Field>
              <FormField label="Font">
                <Box direction="vertical" gap="SP1">
                  <Button size="small" priority="secondary" onClick={handleSelectFont}>
                    Change Font
                  </Button>
                  {elementDesign.font ? (
                    <Text size="tiny" secondary ellipsis>
                      {elementDesign.font}
                    </Text>
                  ) : null}
                </Box>
              </FormField>
            </SidePanel.Field>
          ) : null}

          {designElement.properties.includes('color') ? (
            <SidePanel.Field>
              <FormField label="Text Color">
                <Box width="36px" height="36px">
                  <FillPreview fill={elementDesign.color} onClick={() => handleSelectColor('color')} />
                </Box>
              </FormField>
            </SidePanel.Field>
          ) : null}

          {designElement.properties.includes('background') ? (
            <SidePanel.Field>
              <FormField label="Background Color">
                <Box width="36px" height="36px">
                  <FillPreview fill={elementDesign.background} onClick={() => handleSelectColor('background')} />
                </Box>
              </FormField>
            </SidePanel.Field>
          ) : null}

          <SidePanel.Field>
            <TextButton
              size="small"
              disabled={!design[designElement.id]}
              onClick={() => updateElementDesign(designElement.id, null)}
            >
              Reset {designElement.label} to default
            </TextButton>
          </SidePanel.Field>
        </SidePanel.Content>
        <SidePanel.Footer noPadding>
          <SectionHelper fullWidth skin="standard" border="topBottom">
            Visitors can browse live auctions, filter by countdown timer, and submit bids directly from this widget.
          </SectionHelper>
        </SidePanel.Footer>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default Panel;
