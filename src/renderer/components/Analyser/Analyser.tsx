import React, { useState } from 'react';
import styled from 'styled-components';
import { WordCloud } from '../Visualization/WordCloud';
import { Button, Card, Col, Progress, Row, Statistic } from 'antd';
import { RootState } from '../../reducers';
import { HistoryActionCreatorTypes } from '../History/action';
import { workers } from '../../workers';
import { Bar } from '../Visualization/Bar';
import { GridCalendar } from '../Visualization/GridCalendar';

const Container = styled.div`
    position: relative;
    max-width: 800px;
    margin: 0 auto;
    padding: 2em;
`;

interface Props extends RootState, HistoryActionCreatorTypes {}
export const Analyser: React.FC<Props> = (props: Props) => {
    const [acc, setAcc] = useState<undefined | number>(undefined);
    const [isTraining, setIsTraining] = useState(false);
    const [progress, setProgress] = useState(0);
    const worker = workers.knn;
    const onTrain = async () => {
        if (isTraining) {
            return;
        }

        setIsTraining(true);
        setProgress(0);
        worker
            .test(acc => {
                setAcc(acc);
                setProgress(100);
                setIsTraining(false);
            }, setProgress)
            .catch(console.error);
    };

    const weights: [string, number][] = [
        ['Hate', 100],
        ['Fate', 1],
        ['Test', 3],
        ['Behavior', 10],
        ['Logger', 20]
    ];

    return (
        <Container>
            <Row gutter={16} style={{ marginBottom: 10 }}>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Accuracy"
                            value={acc === undefined ? 'Unknown' : acc}
                            precision={2}
                            valueStyle={{ color: '#3f8600' }}
                        />
                    </Card>
                </Col>
            </Row>
            <Button onClick={onTrain} loading={isTraining}>
                Train
            </Button>
            <Progress percent={progress} size="small" />
            <GridCalendar data={{}} width={800} />
            <div style={{ height: 50, width: 280 }}>
                <Bar values={[5, 10, 100, 20, 30]} names={['123', '123', '22', '22', '123']} />
            </div>
        </Container>
    );
};
